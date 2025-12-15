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
        await fastify.minio.putObject(
            process.env.MINIO_BUCKET || 'documents',
            s3Key,
            await data.toBuffer()
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
        const docs = await fastify.prisma.document.findMany({
            where: { user_id: request.user.id },
            orderBy: { created_at: 'desc' },
            include: {
                sign_requests: {
                    orderBy: { created_at: 'desc' },
                    take: 1
                }
            }
        })
        return docs
    })

    // SIGN REQUEST
    fastify.post('/:id/sign', async (request: any, reply) => {
        const { id } = request.params
        const body = signRequestSchema.parse(request.body)

        const doc = await fastify.prisma.document.findUnique({
            where: { id, user_id: request.user.id }
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

        // Enqueue Job
        await fastify.signQueue.add('sign-pdf', {
            signRequestId: signReq.id,
            documentId: doc.id,
            userId: request.user.id,
            s3KeyInput: doc.s3_key_input,
            certId: cert.id
        })

        return signReq
    })

    // DOWNLOAD
    fastify.get('/:id/download', async (request: any, reply) => {
        const { id } = request.params
        const doc = await fastify.prisma.document.findUnique({
            where: { id, user_id: request.user.id }
        })

        if (!doc) return reply.code(404).send()

        if (doc.status !== 'SIGNED' || !doc.s3_key_signed) {
            return reply.code(400).send({ message: 'Document not signed yet' })
        }

        const stream = await fastify.minio.getObject(
            process.env.MINIO_BUCKET || 'documents',
            doc.s3_key_signed
        )

        reply.header('Content-Disposition', `attachment; filename="signed_${doc.filename}"`)
        return reply.send(stream)
    })
}

export default docsRoutes
