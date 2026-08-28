import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableShutdownHooks();

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true });

  const port = process.env.PORT ?? 3020;
  await app.listen(port, '0.0.0.0');
  console.log(`>>> ${process.env.APP_NAME ?? 'CallingSupportApp'} running on port: ${port}`);
}
bootstrap();
