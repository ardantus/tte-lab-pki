import { Worker } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import * as Minio from 'minio'
import { signPdf } from './services/signing'

const prisma = new PrismaClient()
const minio = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
})

const connection = {
    host: process.env.REDIS_HOST || 'redis',
    port: 6379
}

const worker = new Worker('sign-queue', async job => {
    console.log(`Processing job ${job.id}`, job.data)
    const { signRequestId, documentId, userId, s3KeyInput, certId } = job.data

    try {
        // 1. Update status to PROCESSING
        await prisma.signRequest.update({
            where: { id: signRequestId },
            data: { status: 'PROCESSING' }
        })

        // 2. Fetch required data
        const cert = await prisma.certificate.findUnique({ where: { id: certId } })
        if (!cert) throw new Error('Certificate not found')

        // 3. Download PDF
        const bucket = process.env.MINIO_BUCKET || 'documents'
        const pdfStream = await minio.getObject(bucket, s3KeyInput)
        const pdfBuffer = await streamToBuffer(pdfStream)

        // 4. Decode Key (Assuming stored as JSON in chain_pem as per API hack)
        // Or just encrypted key string if that's what was done.
        // In API cert.ts: chain_pem: JSON.stringify({ key: encryptedKey })

        let privateKeyPem = ''
        try {
            const chainData = JSON.parse(cert.chain_pem)
            const encodedKey = chainData.key
            privateKeyPem = Buffer.from(encodedKey, 'base64').toString('utf8')
        } catch (e) {
            // Fallback if not JSON or other format
            privateKeyPem = Buffer.from(cert.chain_pem, 'base64').toString('utf8')
        }

        // 5. Sign PDF
        const { signedPdf, sha256Input, sha256Signed } = await signPdf({
            pdfBuffer,
            certPem: cert.cert_pem,
            keyPem: privateKeyPem,
            coords: {
                page: job.data.page,
                x: job.data.x,
                y: job.data.y,
                width: job.data.width,
                height: job.data.height
            },
            reason: job.data.reason,
            name: cert.subject_dn // extract name better if possible
        })

        // 6. Upload Signed PDF
        const s3KeySigned = s3KeyInput.replace('input', 'signed').replace('.pdf', '_signed.pdf')
        await minio.putObject(bucket, s3KeySigned, signedPdf)

        // 7. Update DB
        await prisma.$transaction([
            prisma.signRequest.update({
                where: { id: signRequestId },
                data: {
                    status: 'SIGNED',
                    signed_at: new Date()
                }
            }),
            prisma.document.update({
                where: { id: documentId },
                data: {
                    status: 'SIGNED',
                    s3_key_signed: s3KeySigned,
                    sha256_input: sha256Input,
                    sha256_signed: sha256Signed
                }
            })
        ])

        console.log(`Job ${job.id} completed.`)

    } catch (err: any) {
        console.error(`Job ${job.id} failed:`, err)
        await prisma.signRequest.update({
            where: { id: signRequestId },
            data: {
                status: 'FAILED',
                error_message: err.message
            }
        })
        await prisma.document.update({
            where: { id: documentId },
            data: { status: 'FAILED' }
        })
    }

}, { connection })

async function streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = []
        stream.on('data', (chunk: any) => chunks.push(chunk))
        stream.on('end', () => resolve(Buffer.concat(chunks)))
        stream.on('error', reject)
    })
}

console.log('Worker started...')
