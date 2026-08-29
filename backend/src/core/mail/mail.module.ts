import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './email-log.entity';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { ConfigAppModule } from '../config/config.module';
import { SharedGuardsModule } from '../../auth/shared-guards.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog]), ConfigAppModule, SharedGuardsModule],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class CoreMailModule {}
