import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableShutdownHooks();

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true });

  // En producción (self-hosted DirectAdmin) el proceso escucha en un unix
  // socket detrás de Apache (patrón mbnode) en vez de un puerto TCP — se
  // detecta por la presencia de APP_SOCKET, que el provisionador exporta.
  const socketPath = process.env.APP_SOCKET;
  if (socketPath) {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      /* el socket no existía (arranque limpio) */
    }
    await app.listen(socketPath);
    try {
      fs.chmodSync(socketPath, 0o660);
    } catch {
      /* best-effort sobre los permisos del socket */
    }
    console.log(`>>> ${process.env.APP_NAME ?? 'CallingSupportApp'} escuchando en socket: ${socketPath}`);
  } else {
    const port = process.env.PORT ?? 3020;
    await app.listen(port, '0.0.0.0');
    console.log(`>>> ${process.env.APP_NAME ?? 'CallingSupportApp'} running on port: ${port}`);
  }
}
bootstrap();
