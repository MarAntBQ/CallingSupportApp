import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/models/usuario.entity';
import { Role } from '../usuarios/models/role.entity';
import { UsuarioOrganizacion } from '../usuarios/models/usuario-organizacion.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SharedGuardsModule } from './shared-guards.module';
import { CoreHashPasswordsModule } from '../core/hash-passwords/hash-passwords.module';
import { CoreOtpCodeModule } from '../core/otp-code/otp-code.module';
import { CoreMailModule } from '../core/mail/mail.module';
import { ConfigAppModule } from '../core/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Role, UsuarioOrganizacion]),
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
