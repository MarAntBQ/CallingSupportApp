import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { NIVEL_ADMIN_TOTAL } from '../../usuarios/models/role.entity';
import { JwtPayload } from '../jwt-payload.interface';

// Para rutas que administran el sistema entero (config global, catálogo de
// organizaciones, mapeo módulo↔organización, gestión de usuarios) — solo
// Obispado/SuperAdmin, sin excepción por organización.
@Injectable()
export class AdminGlobalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!req.user) throw new ForbiddenException('No autenticado.');
    if (req.user.nivel < NIVEL_ADMIN_TOTAL) {
      throw new ForbiddenException('Solo el Obispado puede administrar esto.');
    }
    return true;
  }
}
