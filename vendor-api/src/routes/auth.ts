import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const registerSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(10),
    national_id_sim: z.string().min(5),
    password: z.string().min(6)
})

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
})

const authRoutes: FastifyPluginAsync = async (fastify, opts) => {

    // REGISTER
    fastify.post('/register', async (request, reply) => {
        const body = registerSchema.parse(request.body)

        // Check duplication
        const existing = await fastify.prisma.user.findUnique({
            where: { email: body.email }
        })

        if (existing) {
            return reply.code(400).send({ message: 'Email already exists' })
        }

        const hashedPassword = await bcrypt.hash(body.password, 10)

        const user = await fastify.prisma.user.create({
            data: {
                name: body.name,
                email: body.email,
                phone: body.phone,
                national_id_sim: body.national_id_sim,
                password_hash: hashedPassword,
                status: 'PENDING',
                role: 'USER'
            }
        })

        return { id: user.id, email: user.email, status: user.status }
    })

    // LOGIN
    fastify.post('/login', async (request, reply) => {
        const { email, password } = loginSchema.parse(request.body)

        const user = await fastify.prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            return reply.code(401).send({ message: 'Invalid credentials' })
        }

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) {
            return reply.code(401).send({ message: 'Invalid credentials' })
        }

        const token = fastify.jwt.sign({
            id: user.id,
            email: user.email,
            role: user.role
        })

        return { token }
    })

    // SIGNATURE UPLOAD
    fastify.post('/signature', {
        onRequest: [fastify.authenticate]
    }, async (request: any, reply) => {
        const data = await request.file()
        if (!data) return reply.code(400).send({ message: 'No file uploaded' })

        const buffer = await data.toBuffer()
        // Save to MinIO
        const key = `signatures/${request.user.id}/${Date.now()}.png`
        await fastify.minio.putObject('documents', key, buffer)

        // Update User
        await fastify.prisma.user.update({
            where: { id: request.user.id },
            data: { signature_image: key }
        })

        return { message: 'Signature updated', key }
    })

    // SIGNATURE GET
    fastify.get('/signature/image', {
        onRequest: [fastify.authenticate]
    }, async (request: any, reply) => {
        const user = await fastify.prisma.user.findUnique({
            where: { id: request.user.id }
        })

        if (!user || !user.signature_image) {
            return reply.code(404).send({ message: 'No signature found' })
        }

        const stream = await fastify.minio.getObject(
            'documents',
            user.signature_image
        )

        reply.header('Content-Type', 'image/png')
        return reply.send(stream)
    })

    // ME
    fastify.get('/me', {
        onRequest: [fastify.authenticate]
    }, async (request: any, reply) => {
        const user = await fastify.prisma.user.findUnique({
            where: { id: request.user.id },
            include: {
                certificates: {
                    where: { status: 'ISSUED' },
                    select: { status: true, serial: true, issued_at: true }
                }
            }
        })

        if (!user) return reply.code(404).send()

        const { password_hash, ...profile } = user
        return profile
    })
}

export default authRoutes
