import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import * as Minio from 'minio'

declare module 'fastify' {
    interface FastifyInstance {
        minio: Minio.Client
    }
}

export interface MinioPluginOptions {
}

const minioPlugin: FastifyPluginAsync<MinioPluginOptions> = async (fastify, options) => {
    const minioClient = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'minio',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    })

    // Ensure bucket exists
    const bucket = process.env.MINIO_BUCKET || 'documents'
    try {
        const exists = await minioClient.bucketExists(bucket)
        if (!exists) {
            await minioClient.makeBucket(bucket, 'us-east-1')
        }
    } catch (e) {
        console.error('Failed to init MinIO bucket', e)
        // Don't crash but some things wont work
    }

    fastify.decorate('minio', minioClient)
}

export default fp(minioPlugin)
