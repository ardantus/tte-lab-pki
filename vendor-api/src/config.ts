import dotenv from 'dotenv'
dotenv.config()

export const config = {
    port: parseInt(process.env.PORT || '3000'),
    jwtSecret: process.env.JWT_SECRET || 'supersecret',
    minio: {
        endPoint: process.env.MINIO_ENDPOINT || 'minio',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        bucket: process.env.MINIO_BUCKET || 'documents'
    }
}
