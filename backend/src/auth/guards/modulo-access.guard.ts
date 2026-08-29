import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import type { Request } from 'express';
import { ModuloLlamamiento } from '../../usuarios/models/modulo-llamamiento.entity';
import { NIVEL_SUPERADMIN } from '../../usuarios/models/role.entity';
import { AccionModulo, MODULO_ACCION_KEY, MODULO_CLAVE_KEY } from '../decorators/requiere-modulo.decorator';
import { JwtPayload } from '../jwt-payload.interface';

const CAMPO_POR_ACCION: Record<AccionModulo, keyof ModuloLlamamiento> = {
  leer: 'puedeLeer',
  crear: 'puedeCrear',
  editar: 'puedeEditar',
  eliminar: 'puedeEliminar',
};

// Se ejecuta DESPUÉS de JwtAuthGuard (que ya dejó `req.user` con el payload
// decodificado) — @RequiereModulo('viaje_templo', 'editar') declara qué
// módulo y qué acción protege esta ruta, y este guard decide: solo
// SuperAdmin pasa sin más (ver NIVEL_SUPERADMIN) — ni Obispado tiene bypass
// acá, porque dentro de una misma organización no todos los llamamientos
// deben ver lo mismo (ej. el Obispo sí administra Viaje al Templo, el
// Secretario Financiero del mismo Obispado no, salvo que se le otorgue). El
// permiso se busca por LLAMAMIENTO específico (ver ModuloLlamamiento), no
// por organización ni por rol.
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

    if (user.nivel >= NIVEL_SUPERADMIN) return true;

    if (user.llamamientoIds.length === 0) {
      throw new ForbiddenException('Tu llamamiento no tiene acceso a este módulo.');
    }

    const campo = CAMPO_POR_ACCION[accion];
    const filas = await this.dataSource
      .getRepository(ModuloLlamamiento)
      .find({ where: { moduloClave, llamamientoId: In(user.llamamientoIds) } });
    const tieneAcceso = filas.some((f) => f[campo] === true);

    if (!tieneAcceso) {
      throw new ForbiddenException('Tu llamamiento no tiene ese permiso en este módulo.');
    }
    return true;
  }
}
