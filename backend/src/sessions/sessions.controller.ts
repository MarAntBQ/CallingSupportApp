import { Controller, Get, Patch, Post, Param, ParseIntPipe, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SessionsService } from './sessions.service';
import { RequiereAdminGlobal } from '../auth/decorators/requiere-admin-global.decorator';

@Controller('sessions')
@RequiereAdminGlobal()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  list() {
    return this.sessionsService.listActive();
  }

  @Patch(':id/revoke')
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.sessionsService.revoke(id);
  }

  @Post('revoke-all-others')
  revokeAllOthers(@Req() req: Request & { token?: string }) {
    return this.sessionsService.revokeAllExcept(req.token);
  }
}
