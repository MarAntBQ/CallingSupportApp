import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/models/usuario.entity';
import { TelegramBotService } from './telegram-bot.service';
import { ConfigAppModule } from '../core/config/config.module';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario]), ConfigAppModule],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
