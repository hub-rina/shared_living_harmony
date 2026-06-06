import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

const PHOTO_BODY_LIMIT = '6mb';

function parseOrigins(value: string | undefined): string[] | boolean {
  if (!value) return true;
  if (value === '*') return true;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);

  app.useBodyParser('json', { limit: PHOTO_BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: true, limit: PHOTO_BODY_LIMIT });
  // Receipt and proof images are served cross-origin to the web app, so relax
  // the default same-origin resource policy for them.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: parseOrigins(config.get<string>('ALLOWED_ORIGINS')),
    credentials: true,
  });
  // Locally stored uploads (STORAGE_DRIVER=local) are served read-only here.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/api/uploads' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(config.get('PORT') ?? config.get('API_PORT') ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`HomeBuddy API listening on :${port}/api`);
}

bootstrap();
