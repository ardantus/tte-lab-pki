import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

const adminRoutes: FastifyPluginAsync = async (fastify, opts) => {

    // Middleware to check ADMIN role
    fastify.addHook('onRequest', async (request: any, reply) => {
        try {
            await request.jwtVerify()
            if (request.user.role !== 'ADMIN') {
                throw new Error('Forbidden')
            }
        } catch (err) {
            reply.code(403).send({ message: 'Forbidden' })
        }
    })

    // GET PENDING USERS
    fastify.get('/users', async (request: any, reply) => {
        const query = request.query as { status?: string }
        const status = query.status === 'PENDING' ? 'PENDING' : undefined

        const users = await fastify.prisma.user.findMany({
            where: status ? { status: 'PENDING' } : undefined,
            select: { id: true, name: true, email: true, status: true, created_at: true }
        })

        return users
    })

    // VERIFY USER
    fastify.post('/users/:id/verify', async (request: any, reply) => {
        const { id } = request.params

        const user = await fastify.prisma.user.update({
            where: { id },
            data: { status: 'VERIFIED' }
        })

        // Audit Log
        await fastify.prisma.auditLog.create({
            data: {
                actor_type: 'USER', // Admin
                actor_id: request.user.id,
                action: 'VERIFY_USER',
                detail_json: { target_user: id },
                ip: request.ip
            }
        })

        return { message: 'User verified', user }
    })

    // REJECT USER
    fastify.post('/users/:id/reject', async (request: any, reply) => {
        const { id } = request.params

        const user = await fastify.prisma.user.update({
            where: { id },
            data: { status: 'REJECTED' }
        })

        await fastify.prisma.auditLog.create({
            data: {
                actor_type: 'USER',
                actor_id: request.user.id,
                action: 'REJECT_USER',
                detail_json: { target_user: id },
                ip: request.ip
            }
        })

        return { message: 'User rejected', user }
    })

    // AUDIT LOGS
    fastify.get('/audit', async (request, reply) => {
        const logs = await fastify.prisma.auditLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 50,
            include: { user: { select: { email: true } } }
        })
        return logs
    })
}

export default adminRoutes
