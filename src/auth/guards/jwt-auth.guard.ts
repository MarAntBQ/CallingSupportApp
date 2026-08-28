import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';

// Verificación directa del Bearer token — sin Passport, mismo estilo simple
// ya usado en otros backends personales de Marco Antonio. Adjunta el payload
// decodificado a `req.user` para que los controladores/guards siguientes
// (ej. ModuloAccessGuard) lo puedan leer.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }
    const token = header.slice('Bearer '.length);
    try {
      req.user = await this.jwtService.verifyAsync<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado.');
    }
  }
}
