import { Controller, Get } from '@nestjs/common';
import { MailService } from './mail.service';
import { RequiereAdminGlobal } from '../../auth/decorators/requiere-admin-global.decorator';

@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('logs')
  @RequiereAdminGlobal()
  listLogs() {
    return this.mailService.listLogs();
  }
}
