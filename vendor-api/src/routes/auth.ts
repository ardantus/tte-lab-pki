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
