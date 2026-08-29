import { Body, Controller, Delete, Get, Ip, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TemploService } from './templo.service';
import { CreateInscripcionDto } from './dto/create-inscripcion.dto';
import { CreateInscripcionAdminDto } from './dto/create-inscripcion-admin.dto';
import { CreateViajeDto, UpdateViajeDto } from './dto/viaje.dto';
import { AprobarParticipanteDto } from './dto/aprobar.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';
import { ActualizarLogisticaDto } from './dto/actualizar-logistica.dto';
import { CreateCobradorDto, UpdateCobradorDto } from './dto/cobrador.dto';
import { CreateAbonoDto, UpdateAbonoDto } from './dto/abono.dto';
import { CreateHabitacionDto, AsignarHabitacionDto } from './dto/habitacion.dto';
import { ActualizarDatosTemploDto } from './dto/datos-templo.dto';
import { RequiereModulo } from '../auth/decorators/requiere-modulo.decorator';

const MODULO = 'viaje_templo';

@Controller('templo')
export class TemploController {
  constructor(private readonly temploService: TemploService) {}

  // Público — sin reCAPTCHA por ahora (pendiente integrarlo; el DTO acepta
  // el campo pero no se verifica todavía). No requiere login: cualquiera
  // puede inscribirse al viaje activo.
  @Post('inscripciones')
  async crear(@Body() dto: CreateInscripcionDto, @Ip() ip: string) {
    return this.temploService.crearInscripcion(dto, ip);
  }

  @Get('inscripciones')
  @RequiereModulo(MODULO, 'leer')
  async listar() {
    return this.temploService.listarInscripciones();
  }

  @Post('inscripciones/admin')
  @RequiereModulo(MODULO, 'crear')
  async crearAdmin(@Body() dto: CreateInscripcionAdminDto) {
    return this.temploService.crearInscripcionAdmin(dto);
  }

  @Patch('participantes/:id/aprobar')
  @RequiereModulo(MODULO, 'editar')
  async aprobarParticipante(@Param('id', ParseIntPipe) id: number, @Body() dto: AprobarParticipanteDto) {
    return this.temploService.aprobarParticipante(id, dto.aprobado);
  }

  @Patch('participantes/:id')
  @RequiereModulo(MODULO, 'editar')
  async actualizarParticipante(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateParticipanteDto) {
    return this.temploService.actualizarParticipante(id, dto);
  }

  @Patch('participantes/:id/logistica')
  @RequiereModulo(MODULO, 'editar')
  async actualizarLogistica(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarLogisticaDto) {
    return this.temploService.actualizarLogistica(id, dto);
  }

  @Get('viaje-activo')
  async viajeActivoPublico() {
    return this.temploService.getViajeActivoPublico();
  }

  @Get('viaje-activo/verificar-cedula')
  async verificarCedula(@Query('cedula') cedula?: string) {
    return this.temploService.cedulaYaRegistrada(cedula ?? '');
  }

  @Post('viajes')
  @RequiereModulo(MODULO, 'crear')
  async crearViaje(@Body() dto: CreateViajeDto) {
    return this.temploService.crearViaje(dto);
  }

  @Get('viajes')
  @RequiereModulo(MODULO, 'leer')
  async listarViajes() {
    return this.temploService.listarViajes();
  }

  @Patch('viajes/:id')
  @RequiereModulo(MODULO, 'editar')
  async actualizarViaje(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateViajeDto) {
    return this.temploService.actualizarViaje(id, dto);
  }

  @Get('viajes/:id/cupos')
  @RequiereModulo(MODULO, 'leer')
  async cuposViaje(@Param('id', ParseIntPipe) id: number) {
    return this.temploService.cuposRestantes(id);
  }

  @Get('cobradores')
  @RequiereModulo(MODULO, 'leer')
  async listarCobradores() {
    return this.temploService.listarCobradores();
  }

  @Post('cobradores')
  @RequiereModulo(MODULO, 'crear')
  async crearCobrador(@Body() dto: CreateCobradorDto) {
    return this.temploService.crearCobrador(dto);
  }

  @Patch('cobradores/:id')
  @RequiereModulo(MODULO, 'editar')
  async actualizarCobrador(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCobradorDto) {
    return this.temploService.actualizarCobrador(id, dto);
  }

  @Post('participantes/:id/abonos')
  @RequiereModulo(MODULO, 'crear')
  async crearAbono(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateAbonoDto) {
    return this.temploService.crearAbono(id, dto);
  }

  @Patch('abonos/:id')
  @RequiereModulo(MODULO, 'editar')
  async actualizarAbono(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAbonoDto) {
    return this.temploService.actualizarAbono(id, dto);
  }

  @Delete('abonos/:id')
  @RequiereModulo(MODULO, 'eliminar')
  async eliminarAbono(@Param('id', ParseIntPipe) id: number) {
    await this.temploService.eliminarAbono(id);
    return { success: true };
  }

  @Get('viajes/:id/habitaciones')
  @RequiereModulo(MODULO, 'leer')
  async listarHabitaciones(@Param('id', ParseIntPipe) id: number) {
    return this.temploService.listarHabitaciones(id);
  }

  @Post('viajes/:id/habitaciones')
  @RequiereModulo(MODULO, 'crear')
  async crearHabitacion(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateHabitacionDto) {
    return this.temploService.crearHabitacion(id, dto);
  }

  @Delete('habitaciones/:id')
  @RequiereModulo(MODULO, 'eliminar')
  async eliminarHabitacion(@Param('id', ParseIntPipe) id: number) {
    await this.temploService.eliminarHabitacion(id);
    return { success: true };
  }

  @Patch('participantes/:id/habitacion')
  @RequiereModulo(MODULO, 'editar')
  async asignarHabitacion(@Param('id', ParseIntPipe) id: number, @Body() dto: AsignarHabitacionDto) {
    return this.temploService.asignarHabitacion(id, dto);
  }

  @Patch('participantes/:id/datos-templo')
  @RequiereModulo(MODULO, 'editar')
  async actualizarDatosTemplo(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarDatosTemploDto) {
    return this.temploService.actualizarDatosTemplo(id, dto);
  }

  @Get('viajes/:id/habitaciones/excel')
  @RequiereModulo(MODULO, 'leer')
  async generarExcelHabitaciones(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const buffer = await this.temploService.generarExcelHabitaciones(id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="habitaciones-viaje-${id}.xlsx"`,
    });
    res.send(buffer);
  }
}
