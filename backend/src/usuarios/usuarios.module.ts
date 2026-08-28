import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './models/role.entity';
import { Organizacion } from './models/organizacion.entity';
import { Usuario } from './models/usuario.entity';
import { UsuarioOrganizacion } from './models/usuario-organizacion.entity';
import { ModuloOrganizacion } from './models/modulo-organizacion.entity';
import { UsuariosSeedService } from './usuarios-seed.service';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { SharedGuardsModule } from '../auth/shared-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Organizacion, Usuario, UsuarioOrganizacion, ModuloOrganizacion]),
    SharedGuardsModule,
  ],
  providers: [UsuariosSeedService, UsuariosService],
  controllers: [UsuariosController],
})
export class UsuariosModule {}
