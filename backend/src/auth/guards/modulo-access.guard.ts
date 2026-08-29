import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { Request } from 'express';
import { ModuloOrganizacion } from '../../usuarios/models/modulo-organizacion.entity';
import { NIVEL_ADMIN_TOTAL, NIVEL_LIDER } from '../../usuarios/models/role.entity';
import { AccionModulo, MODULO_ACCION_KEY, MODULO_CLAVE_KEY } from '../decorators/requiere-modulo.decorator';
import { JwtPayload } from '../jwt-payload.interface';

const CAMPO_POR_ACCION: Record<AccionModulo, keyof ModuloOrganizacion> = {
  leer: 'puedeLeer',
  crear: 'puedeCrear',
  editar: 'puedeEditar',
  eliminar: 'puedeEliminar',
};

// Se ejecuta DESPUÉS de JwtAuthGuard (que ya dejó `req.user` con el payload
// decodificado) — @RequiereModulo('viaje_templo', 'editar') declara qué
// módulo y qué acción protege esta ruta, y este guard decide: Obispado/
// SuperAdmin pasan siempre; un Líder pasa solo si alguna de sus
// organizaciones tiene ESE permiso específico habilitado para ese módulo
// (una organización puede tener solo lectura, por ejemplo); cualquier otro
// rol queda afuera.
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
    const accion = this.reflector.get<AccionModulo>(MODULO_ACCION_KEY, context.getHandler()) ?? 'leer';

    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('No autenticado.');

    if (user.nivel >= NIVEL_ADMIN_TOTAL) return true;

    // Un llamamiento de maestro/especialista/consultor (rol Miembro) no debe
    // heredar el permiso de su organización solo por pertenecer a ella — ese
    // permiso es para la presidencia/secretaría (rol Líder), no para todo el
    // que tenga cualquier llamamiento ahí.
    if (user.nivel < NIVEL_LIDER) {
      throw new ForbiddenException('Tu llamamiento no incluye permisos de administración.');
    }

    if (user.orgIds.length === 0) {
      throw new ForbiddenException('No tienes una organización asignada para administrar este módulo.');
    }

    const campo = CAMPO_POR_ACCION[accion];
    const filas = await this.dataSource
      .getRepository(ModuloOrganizacion)
      .find({ where: { moduloClave, organizacionId: In(user.orgIds) } });
    const tieneAcceso = filas.some((f) => f[campo] === true);

    if (!tieneAcceso) {
      throw new ForbiddenException('Tu organización no tiene ese permiso en este módulo.');
    }
    return true;
  }
}
