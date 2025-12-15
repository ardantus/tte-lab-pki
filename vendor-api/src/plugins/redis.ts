import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { Queue } from 'bullmq'

declare module 'fastify' {
    interface FastifyInstance {
        signQueue: Queue
    }
}

export interface RedisPluginOptions {
}

const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (fastify, options) => {
    const connection = {
        host: 'redis',
        port: 6379
    }

    const signQueue = new Queue('sign-queue', { connection })

    fastify.decorate('signQueue', signQueue)

    fastify.addHook('onClose', async () => {
        await signQueue.close()
    })
}

export default fp(redisPlugin)
