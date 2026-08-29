import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';
import { JwtSessionsService } from '../jwt-sessions.service';

// Verificación directa del Bearer token — sin Passport, mismo estilo simple
// ya usado en otros backends personales de Marco Antonio. Adjunta el payload
// decodificado a `req.user` para que los controladores/guards siguientes
// (ej. ModuloAccessGuard) lo puedan leer.
//
// Valida contra jwt_generated (vía JwtSessionsService), no solo la firma —
// mismo modelo que MarbustSystem: un token con firma válida pero revocado
// (logout, cambio de contraseña, revocación admin) deja de servir de
// inmediato, sin esperar a su expiración natural.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtSessionsService: JwtSessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload; token?: string }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de autenticación.');
    }
    const token = header.slice('Bearer '.length);
    try {
      req.user = await this.jwtSessionsService.verifyPersisted(token);
      req.token = token;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido, expirado o revocado.');
    }
  }
}
