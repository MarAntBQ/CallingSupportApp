import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ModuloAccessGuard } from '../guards/modulo-access.guard';

export const MODULO_CLAVE_KEY = 'moduloClave';

// Uso: @RequiereModulo('viaje_templo') sobre una ruta de controlador —
// exige JWT válido y, si el rol no es Obispado/SuperAdmin, que el usuario
// pertenezca a una organización habilitada para esa clave de módulo.
export function RequiereModulo(moduloClave: string) {
  return applyDecorators(SetMetadata(MODULO_CLAVE_KEY, moduloClave), UseGuards(JwtAuthGuard, ModuloAccessGuard));
}
