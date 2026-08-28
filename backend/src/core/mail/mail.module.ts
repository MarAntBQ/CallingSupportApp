import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from './email-log.entity';
import { MailService } from './mail.service';
import { ConfigAppModule } from '../config/config.module';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog]), ConfigAppModule],
  providers: [MailService],
  exports: [MailService],
})
export class CoreMailModule {}
