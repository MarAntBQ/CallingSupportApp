import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGlobalGuard } from '../guards/admin-global.guard';

export function RequiereAdminGlobal() {
  return applyDecorators(UseGuards(JwtAuthGuard, AdminGlobalGuard));
}
