import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { ModuloOrganizacion } from '../../usuarios/models/modulo-organizacion.entity';
import { NIVEL_ADMIN_TOTAL } from '../../usuarios/models/role.entity';
import { MODULO_CLAVE_KEY } from '../decorators/requiere-modulo.decorator';
import { JwtPayload } from '../jwt-payload.interface';

// Se ejecuta DESPUÉS de JwtAuthGuard (que ya dejó `req.user` con el payload
// decodificado) — @RequiereModulo('viaje_templo') declara qué módulo protege
// esta ruta, y este guard decide: Obispado/SuperAdmin pasan siempre; un
// Líder pasa solo si alguna de sus organizaciones está habilitada para ese
// módulo; cualquier otro rol queda afuera.
//
// Usa DataSource directo (no @InjectRepository) a propósito: este guard se
// referencia por clase vía @UseGuards() desde decoradores usados en MUCHOS
// módulos distintos, y @InjectRepository ata la resolución al forFeature()
// del módulo donde el guard fue declarado — DataSource es el único provider
// de TypeORM que cuelga limpio de TypeOrmModule.forRoot() sin ese problema.
@Injectable()
export class ModuloAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduloClave = this.reflector.get<string>(MODULO_CLAVE_KEY, context.getHandler());
    if (!moduloClave) return true; // el decorador no se aplicó — no hay módulo que chequear

    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('No autenticado.');

    if (user.nivel >= NIVEL_ADMIN_TOTAL) return true;

    if (user.orgIds.length === 0) {
      throw new ForbiddenException('No tienes una organización asignada para administrar este módulo.');
    }

    const habilitadas = await this.dataSource.getRepository(ModuloOrganizacion).find({ where: { moduloClave } });
    const orgIdsHabilitados = new Set(habilitadas.map((h) => h.organizacionId));
    const tieneAcceso = user.orgIds.some((id) => orgIdsHabilitados.has(id));

    if (!tieneAcceso) {
      throw new ForbiddenException('Tu organización no administra este módulo.');
    }
    return true;
  }
}
