import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
// helper to get file from multipart
// @fastify/multipart handles it

const signRequestSchema = z.object({
    page: z.number().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    reason: z.string().optional().default('Digital Signature')
})

const docsRoutes: FastifyPluginAsync = async (fastify, opts) => {

    fastify.addHook('onRequest', fastify.authenticate)

    // UPLOAD
    fastify.post('/upload', async (request, reply) => {
        const data = await request.file()
        if (!data) {
            return reply.code(400).send({ message: 'No file uploaded' })
        }

        // Validate PDF
        if (data.mimetype !== 'application/pdf') {
            return reply.code(400).send({ message: 'Only PDF allowed' })
        }

        const { user } = request as any
        const fileId = randomUUID()
        const s3Key = `input/${user.id}/${fileId}.pdf`

        // Upload to MinIO
        const buffer = await data.toBuffer()

        await fastify.minio.putObject(
            process.env.MINIO_BUCKET || 'documents',
            s3Key,
            buffer
        )

        // Save to DB
        const doc = await fastify.prisma.document.create({
            data: {
                id: fileId,
                user_id: user.id,
                filename: data.filename,
                s3_key_input: s3Key,
                sha256_input: 'TODO_CALCULATE_HASH', // Simplified for lab
                status: 'UPLOADED'
            }
        })

        return doc
    })

    // LIST
    fastify.get('/', async (request: any, reply) => {
        // Fetch docs where user is owner OR user's email is in DocumentAccess
        const docs = await fastify.prisma.document.findMany({
            where: {
                OR: [
                    { user_id: request.user.id },
                    {
                        access: {
                            some: {
                                user_email: request.user.email
                            }
                        }
                    }
                ]
            },
            orderBy: { created_at: 'desc' },
            include: {
                sign_requests: {
                    orderBy: { created_at: 'desc' },
                    take: 5 // Take more to trace history
                },
                access: true, // Include access list
                user: { // Include owner info
                    select: { name: true, email: true }
                }
            }
        })
        return docs
    })

    // SHARE
    fastify.post('/:id/share', async (request: any, reply) => {
        const { id } = request.params
        const { email } = z.object({ email: z.string().email() }).parse(request.body)

        const doc = await fastify.prisma.document.findUnique({
            where: { id, user_id: request.user.id }
        })

        if (!doc) return reply.code(404).send()

        // Create Access
        const access = await fastify.prisma.documentAccess.create({
            data: {
                document_id: doc.id,
                user_email: email,
                role: 'SIGNER'
            }
        })

        return access
    })

    // SIGN REQUEST
    fastify.post('/:id/sign', async (request: any, reply) => {
        const { id } = request.params
        const body = signRequestSchema.parse(request.body)

        const doc = await fastify.prisma.document.findFirst({
            where: {
                id,
                OR: [
                    { user_id: request.user.id },
                    { access: { some: { user_email: request.user.email } } }
                ]
            }
        })

        if (!doc) return reply.code(404).send()

        // Check if user has certificate
        const cert = await fastify.prisma.certificate.findFirst({
            where: { user_id: request.user.id, status: 'ISSUED' }
        })

        if (!cert) {
            return reply.code(400).send({ message: 'No active certificate found' })
        }

        // Create Sign Request
        const signReq = await fastify.prisma.signRequest.create({
            data: {
                document_id: doc.id,
                user_id: request.user.id,
                ...body,
                status: 'QUEUED'
            }
        })

        // Update Doc Status
        await fastify.prisma.document.update({
            where: { id: doc.id },
            data: { status: 'SIGNING' }
        })

        // Determine input file: If already signed, use that as base for next sig
        const sourceKey = doc.s3_key_signed || doc.s3_key_input

        // Enqueue Job
        await fastify.signQueue.add('sign-pdf', {
            signRequestId: signReq.id,
            documentId: doc.id,
            userId: request.user.id,
            s3KeyInput: sourceKey,
            certId: cert.id,
            ...body
        })

        return signReq
    })

    // DOWNLOAD
    fastify.get('/:id/download', async (request: any, reply) => {
        const { id } = request.params
        const doc = await fastify.prisma.document.findFirst({
            where: {
                id,
                OR: [
                    { user_id: request.user.id },
                    { access: { some: { user_email: request.user.email } } }
                ]
            }
        })

        if (!doc) return reply.code(404).send()

        // If signed, download signed. If not, download input (for preview/signing).
        let s3Key = doc.s3_key_signed
        let filename = `signed_${doc.filename}`

        if (doc.status !== 'SIGNED' || !s3Key) {
            s3Key = doc.s3_key_input
            filename = doc.filename
        }

        const stream = await fastify.minio.getObject(
            process.env.MINIO_BUCKET || 'documents',
            s3Key!
        )

        reply.header('Content-Disposition', `attachment; filename="${filename}"`)
        return reply.send(stream)
    })
}

export default docsRoutes
