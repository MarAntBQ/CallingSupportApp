import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/models/usuario.entity';
import { Role } from '../usuarios/models/role.entity';
import { UsuarioLlamamiento } from '../usuarios/models/usuario-llamamiento.entity';
import { ModuloLlamamiento } from '../usuarios/models/modulo-llamamiento.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SharedGuardsModule } from './shared-guards.module';
import { CoreHashPasswordsModule } from '../core/hash-passwords/hash-passwords.module';
import { CoreOtpCodeModule } from '../core/otp-code/otp-code.module';
import { CoreMailModule } from '../core/mail/mail.module';
import { ConfigAppModule } from '../core/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Role, UsuarioLlamamiento, ModuloLlamamiento]),
    SharedGuardsModule,
    CoreHashPasswordsModule,
    CoreOtpCodeModule,
    CoreMailModule,
    ConfigAppModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
