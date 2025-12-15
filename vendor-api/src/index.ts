import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { PrismaClient } from '@prisma/client'

// Routes
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import certRoutes from './routes/cert'
import docsRoutes from './routes/docs'

// Plugins
import dbPlugin, { DbPluginOptions } from './plugins/db'
import redisPlugin, { RedisPluginOptions } from './plugins/redis'
import minioPlugin, { MinioPluginOptions } from './plugins/minio'

const server: FastifyInstance = Fastify({
    logger: true
})

// Types
declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient
        authenticate: any
    }
}

async function start() {
    try {
        // 1. Env check
        const JWT_SECRET = process.env.JWT_SECRET || 'supersecret'

        // 2. Register Core Plugins
        await server.register(cors, {
            origin: '*' // In production configure strict CORS
        })

        await server.register(multipart)

        await server.register(jwt, {
            secret: JWT_SECRET
        })

        await server.register(swagger, {
            swagger: {
                info: {
                    title: 'TTE Vendor API',
                    description: 'PKI Digital Signature Vendor API',
                    version: '1.0.0'
                },
                securityDefinitions: {
                    apiKey: {
                        type: 'apiKey',
                        name: 'Authorization',
                        in: 'header'
                    }
                }
            }
        })

        await server.register(swaggerUi, {
            routePrefix: '/docs'
        })

        // 3. Register Custom Plugins
        await server.register(dbPlugin)
        await server.register(redisPlugin)
        await server.register(minioPlugin)

        // 4. Decorator for Auth
        server.decorate('authenticate', async function (request: any, reply: any) {
            try {
                await request.jwtVerify()
            } catch (err) {
                reply.send(err)
            }
        })

        // 5. Register Routes
        await server.register(authRoutes, { prefix: '/auth' })
        await server.register(adminRoutes, { prefix: '/admin' })
        await server.register(certRoutes, { prefix: '/cert' })
        await server.register(docsRoutes, { prefix: '/documents' })

        // Health Check
        server.get('/health', async () => {
            return { status: 'ok' }
        })

        // 6. Start Server
        const PORT = 3000
        await server.listen({ port: PORT, host: '0.0.0.0' })
        console.log(`Server listening on ${PORT}`)

    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

start()
