import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequiereAdminGlobal } from '../auth/decorators/requiere-admin-global.decorator';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { SetModuloOrganizacionesDto } from './dto/set-modulo-organizaciones.dto';

@Controller()
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // Lectura abierta a cualquier usuario logueado — hacen falta para llenar
  // selects (asignar rol/organización) en las pantallas de administración.
  @Get('roles')
  @UseGuards(JwtAuthGuard)
  listarRoles() {
    return this.usuariosService.listarRoles();
  }

  @Get('organizaciones')
  @UseGuards(JwtAuthGuard)
  listarOrganizaciones() {
    return this.usuariosService.listarOrganizaciones();
  }

  @Post('organizaciones')
  @RequiereAdminGlobal()
  crearOrganizacion(@Body() dto: CreateOrganizacionDto) {
    return this.usuariosService.crearOrganizacion(dto);
  }

  @Patch('organizaciones/:id')
  @RequiereAdminGlobal()
  actualizarOrganizacion(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrganizacionDto) {
    return this.usuariosService.actualizarOrganizacion(id, dto);
  }

  @Get('usuarios')
  @RequiereAdminGlobal()
  listarUsuarios() {
    return this.usuariosService.listarUsuarios();
  }

  @Post('usuarios')
  @RequiereAdminGlobal()
  crearUsuario(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.crearUsuario(dto);
  }

  @Patch('usuarios/:id')
  @RequiereAdminGlobal()
  actualizarUsuario(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.actualizarUsuario(id, dto);
  }

  @Get('consejo-barrio')
  @RequiereAdminGlobal()
  listarConsejoBarrio() {
    return this.usuariosService.listarConsejoBarrio();
  }

  @Get('modulo-organizaciones')
  @RequiereAdminGlobal()
  listarModuloOrganizaciones() {
    return this.usuariosService.listarModuloOrganizaciones();
  }

  @Post('modulo-organizaciones')
  @RequiereAdminGlobal()
  fijarModuloOrganizaciones(@Body() dto: SetModuloOrganizacionesDto) {
    return this.usuariosService.fijarModuloOrganizaciones(dto);
  }
}
