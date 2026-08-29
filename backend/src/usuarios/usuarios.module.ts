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

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Organizacion, Llamamiento, Usuario, UsuarioLlamamiento, ModuloLlamamiento]),
    SharedGuardsModule,
    CoreMailModule,
    CoreHashPasswordsModule,
  ],
  providers: [UsuariosSeedService, UsuariosService],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
