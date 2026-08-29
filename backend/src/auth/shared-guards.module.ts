import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ModuloAccessGuard } from './guards/modulo-access.guard';
import { AdminGlobalGuard } from './guards/admin-global.guard';
import { JwtSessionsService } from './jwt-sessions.service';

// @Global() a propósito: los guards se aplican vía @UseGuards(ClaseX) por
// referencia de clase en decoradores como @RequiereModulo/@RequiereAdminGlobal
// — Nest resuelve esas dependencias contra el módulo DONDE VIVE EL
// CONTROLADOR que usa el decorador, no contra este módulo, así que cada
// controlador que los use necesitaría importar este módulo igual (fácil de
// olvidar). @Global() lo deja disponible en cualquier módulo sin tener que
// importarlo cada vez — el resto (TypeOrmModule.forFeature, JwtModule) se
// mantiene local a este módulo, solo los guards quedan globales.
@Global()
@Module({
  imports: [
    // registerAsync (no register) a propósito: register() lee process.env en
    // el momento del import, que ocurre ANTES de que dotenv.config() corra en
    // main.ts — el secreto siempre salía undefined. useFactory se evalúa
    // recién cuando Nest instancia el módulo, ya con el .env cargado.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  providers: [JwtAuthGuard, ModuloAccessGuard, AdminGlobalGuard, JwtSessionsService],
  exports: [JwtAuthGuard, ModuloAccessGuard, AdminGlobalGuard, JwtModule, JwtSessionsService],
})
export class SharedGuardsModule {}
