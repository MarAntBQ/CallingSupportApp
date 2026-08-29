import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../guards/modulo-access.guard';

export const MODULO_CLAVE_KEY = 'moduloClave';
export const MODULO_ACCION_KEY = 'moduloAccion';

export type AccionModulo = 'leer' | 'crear' | 'editar' | 'eliminar';

// Uso: @RequiereModulo('viaje_templo', 'editar') sobre una ruta de
// controlador — exige JWT válido y, salvo SuperAdmin, que alguno de los
// llamamientos del usuario tenga ese permiso específico habilitado para esa
// clave de módulo (no solo "puede administrar sí/no" — un llamamiento puede
// tener acceso de solo lectura, por ejemplo).
export function RequiereModulo(moduloClave: string, accion: AccionModulo = 'leer') {
  return applyDecorators(
    SetMetadata(MODULO_CLAVE_KEY, moduloClave),
    SetMetadata(MODULO_ACCION_KEY, accion),
    UseGuards(JwtAuthGuard, ModuloAccessGuard),
  );
}
