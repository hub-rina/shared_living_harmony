import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';

export type DecodedImage = { buffer: Buffer; mime: string; ext: string };

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

// Stores user-uploaded images (receipts, proof-of-payment) behind a single
// interface. The `local` driver writes to disk and is the zero-config default
// for dev; the `s3` driver targets any S3-compatible bucket (Cloudflare R2 or a
// self-hosted MinIO) for production. Both accept a base64 data URL.
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3';
  private readonly uploadsDir: string;
  private readonly publicBaseUrl: string;
  private s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('STORAGE_DRIVER') === 's3' ? 's3' : 'local';
    this.uploadsDir = join(process.cwd(), 'uploads');
    this.publicBaseUrl = (
      this.config.get<string>('API_PUBLIC_URL') ??
      this.config.get<string>('API_URL') ??
      'http://localhost:4000'
    ).replace(/\/$/, '');
  }

  decodeDataUrl(dataUrl: string): DecodedImage {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) throw new BadRequestException('Expected a base64 image data URL');
    const mime = match[1]!.toLowerCase();
    const ext = EXT_BY_MIME[mime];
    if (!ext) throw new BadRequestException('Unsupported image type');
    return { buffer: Buffer.from(match[2]!, 'base64'), mime, ext };
  }

  async store(image: DecodedImage, prefix: string): Promise<string> {
    const key = `${prefix}/${randomUUID()}.${image.ext}`;
    return this.driver === 's3' ? this.storeS3(key, image) : this.storeLocal(key, image);
  }

  private async storeLocal(key: string, image: DecodedImage): Promise<string> {
    const target = join(this.uploadsDir, key);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, image.buffer);
    return `${this.publicBaseUrl}/api/uploads/${key}`;
  }

  private async storeS3(key: string, image: DecodedImage): Promise<string> {
    const bucket = this.requireConfig('S3_BUCKET');
    const client = this.s3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: image.buffer,
        ContentType: image.mime,
      }),
    );
    const publicBase = this.requireConfig('S3_PUBLIC_URL').replace(/\/$/, '');
    return `${publicBase}/${key}`;
  }

  private s3Client(): S3Client {
    if (this.s3) return this.s3;
    const options: S3ClientConfig = {
      region: this.config.get<string>('S3_REGION') ?? 'auto',
      endpoint: this.requireConfig('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.requireConfig('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.requireConfig('S3_SECRET_ACCESS_KEY'),
      },
    };
    this.s3 = new S3Client(options);
    return this.s3;
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new BadRequestException(`Storage misconfigured: ${key} is not set`);
    return value;
  }
}
