import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

export interface DbPluginOptions {
}

const dbPlugin: FastifyPluginAsync<DbPluginOptions> = async (fastify, options) => {
    const prisma = new PrismaClient()
    await prisma.$connect()

    fastify.decorate('prisma', prisma)

    fastify.addHook('onClose', async (server) => {
        await server.prisma.$disconnect()
    })
}

export default fp(dbPlugin)
