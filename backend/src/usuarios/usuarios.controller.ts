import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequiereModulo } from '../auth/decorators/requiere-modulo.decorator';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { CreateLlamamientoDto } from './dto/create-llamamiento.dto';
import { UpdateLlamamientoDto } from './dto/update-llamamiento.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { SetModuloLlamamientosDto } from './dto/set-modulo-llamamientos.dto';

@Controller()
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  // Lectura abierta a cualquier usuario logueado — hacen falta para llenar
  // selects (asignar rol/llamamiento) en las pantallas de administración.
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
  @RequiereModulo('llamamientos', 'crear')
  crearOrganizacion(@Body() dto: CreateOrganizacionDto) {
    return this.usuariosService.crearOrganizacion(dto);
  }

  @Patch('organizaciones/:id')
  @RequiereModulo('llamamientos', 'editar')
  actualizarOrganizacion(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrganizacionDto) {
    return this.usuariosService.actualizarOrganizacion(id, dto);
  }

  @Get('llamamientos')
  @UseGuards(JwtAuthGuard)
  listarLlamamientos() {
    return this.usuariosService.listarLlamamientos();
  }

  @Post('llamamientos')
  @RequiereModulo('llamamientos', 'crear')
  crearLlamamiento(@Body() dto: CreateLlamamientoDto) {
    return this.usuariosService.crearLlamamiento(dto);
  }

  @Patch('llamamientos/:id')
  @RequiereModulo('llamamientos', 'editar')
  actualizarLlamamiento(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLlamamientoDto) {
    return this.usuariosService.actualizarLlamamiento(id, dto);
  }

  @Get('usuarios')
  @RequiereModulo('usuarios', 'leer')
  listarUsuarios() {
    return this.usuariosService.listarUsuarios();
  }

  @Post('usuarios')
  @RequiereModulo('usuarios', 'crear')
  crearUsuario(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.crearUsuario(dto);
  }

  @Patch('usuarios/:id')
  @RequiereModulo('usuarios', 'editar')
  actualizarUsuario(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUsuarioDto) {
    return this.usuariosService.actualizarUsuario(id, dto);
  }

  // Genera y devuelve una contraseña temporal nueva UNA sola vez — el admin
  // debe copiarla y entregarla en persona (prohibido reenviarla por correo a
  // cuentas reales de barrio).
  @Post('usuarios/:id/restablecer-password')
  @RequiereModulo('usuarios', 'editar')
  restablecerPassword(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.restablecerPassword(id);
  }

  @Post('usuarios/:id/desvincular-telegram')
  @RequiereModulo('usuarios', 'editar')
  desvincularTelegram(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.desvincularTelegramDeUsuario(id);
  }

  @Get('consejo-barrio')
  @RequiereModulo('usuarios', 'leer')
  listarConsejoBarrio() {
    return this.usuariosService.listarConsejoBarrio();
  }

  @Get('modulo-llamamientos')
  @RequiereModulo('permisos', 'leer')
  listarModuloLlamamientos() {
    return this.usuariosService.listarModuloLlamamientos();
  }

  @Post('modulo-llamamientos')
  @RequiereModulo('permisos', 'editar')
  fijarModuloLlamamientos(@Body() dto: SetModuloLlamamientosDto) {
    return this.usuariosService.fijarModuloLlamamientos(dto);
  }
}
