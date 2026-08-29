import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './models/role.entity';
import { Organizacion } from './models/organizacion.entity';
import { Llamamiento } from './models/llamamiento.entity';
import { Usuario } from './models/usuario.entity';
import { UsuarioLlamamiento } from './models/usuario-llamamiento.entity';
import { ModuloLlamamiento } from './models/modulo-llamamiento.entity';
import { UsuariosSeedService } from './usuarios-seed.service';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { SharedGuardsModule } from '../auth/shared-guards.module';
import { CoreMailModule } from '../core/mail/mail.module';
import { CoreHashPasswordsModule } from '../core/hash-passwords/hash-passwords.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Organizacion, Llamamiento, Usuario, UsuarioLlamamiento, ModuloLlamamiento]),
    SharedGuardsModule,
    CoreMailModule,
    CoreHashPasswordsModule,
    TelegramBotModule,
  ],
  providers: [UsuariosSeedService, UsuariosService],
  controllers: [UsuariosController],
  exports: [UsuariosService],
})
export class UsuariosModule {}
