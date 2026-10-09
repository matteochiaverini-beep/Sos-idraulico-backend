import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'auto',
  endpoint: process.env.AWS_ENDPOINT_URL,
  forcePathStyle: true,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET;

function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export async function uploadMedia(file) {
  const key = `richieste/${Date.now()}-${crypto.randomUUID()}-${safeName(file.originalname)}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype,
  }));
  return key;
}

export async function getMediaUrl(key) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 }
  );
}
