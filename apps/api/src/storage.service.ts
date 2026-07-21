import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly bucket = process.env.S3_PACKET_BUCKET ?? 'bandboard-packets';
  private readonly region = process.env.AWS_REGION ?? 'us-east-1';
  private readonly credentials = process.env.AWS_ENDPOINT_URL
    ? { accessKeyId: 'test', secretAccessKey: 'test' }
    : undefined;
  private readonly client = new S3Client({
    region: this.region,
    endpoint: process.env.AWS_ENDPOINT_URL,
    forcePathStyle: Boolean(process.env.AWS_ENDPOINT_URL),
    credentials: this.credentials,
  });
  private readonly publicClient = new S3Client({
    region: this.region,
    endpoint: process.env.AWS_PUBLIC_ENDPOINT_URL,
    forcePathStyle: Boolean(process.env.AWS_PUBLIC_ENDPOINT_URL),
    credentials: this.credentials,
  });

  async putPacket(key: string, body: Buffer) {
    const checksum = createHash('sha256').update(body).digest('hex');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
        ContentDisposition: 'attachment; filename="bandboard-event-packet.pdf"',
        Metadata: { sha256: checksum },
        ServerSideEncryption: process.env.AWS_ENDPOINT_URL
          ? undefined
          : 'AES256',
      }),
    );
    return { key, checksum, byteSize: body.length };
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 300 },
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
