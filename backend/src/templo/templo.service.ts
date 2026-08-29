import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemploInscripcion } from './templo-inscripcion.entity';
import { TemploParticipante } from './templo-participante.entity';
import { TemploViaje } from './templo-viaje.entity';
import { TemploCobrador } from './templo-cobrador.entity';
import { TemploAbono } from './templo-abono.entity';
import { TemploHabitacion } from './templo-habitacion.entity';
import { CreateInscripcionDto, ParticipanteDto } from './dto/create-inscripcion.dto';
import { CreateInscripcionAdminDto } from './dto/create-inscripcion-admin.dto';
import { UpdateParticipanteDto } from './dto/update-participante.dto';
import { ActualizarLogisticaDto } from './dto/actualizar-logistica.dto';
import { CreateViajeDto, UpdateViajeDto } from './dto/viaje.dto';
import { CreateCobradorDto, UpdateCobradorDto } from './dto/cobrador.dto';
import { CreateAbonoDto, UpdateAbonoDto } from './dto/abono.dto';
import { CreateHabitacionDto, AsignarHabitacionDto } from './dto/habitacion.dto';
import { ActualizarDatosTemploDto } from './dto/datos-templo.dto';
import * as ExcelJS from 'exceljs';
import { buildInscripcionEmailHtml } from './templo-email-template';
import { ConfigAppService } from '../core/config/config.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  ORDENANZAS,
  GENEROS,
  Ordenanza,
  Genero,
  campoCupoOrdenanza,
  calcularEdad,
  EDAD_MINIMA_ORDENANZAS,
  normalizarCedula,
} from './templo.constants';

@Injectable()
export class TemploService {
  constructor(
    @InjectRepository(TemploInscripcion)
    private readonly inscripcionRepo: Repository<TemploInscripcion>,
    @InjectRepository(TemploParticipante)
    private readonly participanteRepo: Repository<TemploParticipante>,
    @InjectRepository(TemploViaje)
    private readonly viajeRepo: Repository<TemploViaje>,
    @InjectRepository(TemploCobrador)
    private readonly cobradorRepo: Repository<TemploCobrador>,
    @InjectRepository(TemploAbono)
    private readonly abonoRepo: Repository<TemploAbono>,
    @InjectRepository(TemploHabitacion)
    private readonly habitacionRepo: Repository<TemploHabitacion>,
    private readonly configAppService: ConfigAppService,
    private readonly usuariosService: UsuariosService,
  ) {}

  // ---------- Viajes ----------

  // Las columnas de costo son decimal (string en TypeORM) pero llegan como
  // number desde el DTO — se convierten aquí antes de guardar.
  private normalizarCostos(dto: CreateViajeDto | UpdateViajeDto): Partial<TemploViaje> {
    const { costoTransporte, costoDesayuno, costoAlmuerzo, ...resto } = dto;
    return {
      ...resto,
      ...(costoTransporte !== undefined ? { costoTransporte: costoTransporte.toFixed(2) } : {}),
      ...(costoDesayuno !== undefined ? { costoDesayuno: costoDesayuno.toFixed(2) } : {}),
      ...(costoAlmuerzo !== undefined ? { costoAlmuerzo: costoAlmuerzo.toFixed(2) } : {}),
    };
  }

  async crearViaje(dto: CreateViajeDto): Promise<TemploViaje> {
    if (dto.activo) {
      await this.viajeRepo.update({ activo: true }, { activo: false });
    }
    return this.viajeRepo.save(this.viajeRepo.create(this.normalizarCostos(dto)));
  }

  async listarViajes(): Promise<TemploViaje[]> {
    return this.viajeRepo.find({ order: { fecha: 'DESC' } });
  }

  async actualizarViaje(id: number, dto: UpdateViajeDto): Promise<TemploViaje> {
    const viaje = await this.viajeRepo.findOne({ where: { id } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');

    if (dto.activo) {
      await this.viajeRepo.update({ activo: true }, { activo: false });
    }

    Object.assign(viaje, this.normalizarCostos(dto));
    return this.viajeRepo.save(viaje);
  }

  private async getViajeActivo(): Promise<TemploViaje> {
    const viaje = await this.viajeRepo.findOne({ where: { activo: true } });
    if (!viaje) {
      throw new BadRequestException('No hay ningún viaje al templo activo en este momento.');
    }
    return viaje;
  }

  // Cupos ocupados = solo participantes APROBADOS de ESTE viaje. Los
  // pendientes de revisar no cuentan todavía.
  private async cuposOcupados(
    viajeId: number,
    excluirParticipanteId?: number,
  ): Promise<{
    transporte: number;
    hospedaje: number;
    porOrdenanzaGenero: Map<string, number>;
  }> {
    const qb = this.participanteRepo
      .createQueryBuilder('p')
      .innerJoin('p.inscripcion', 'i')
      .where('i.viajeId = :viajeId', { viajeId })
      .andWhere('p.aprobado = true');
    if (excluirParticipanteId) {
      qb.andWhere('p.id != :excluirId', { excluirId: excluirParticipanteId });
    }
    const aprobados = await qb.getMany();

    let transporte = 0;
    let hospedaje = 0;
    const porOrdenanzaGenero = new Map<string, number>();

    for (const p of aprobados) {
      if (p.vaEnTransporte) transporte++;
      if (p.necesitaHospedaje) hospedaje++;
      const ordenanzas = p.ordenanzas ? p.ordenanzas.split(', ').filter(Boolean) : [];
      for (const ord of ordenanzas) {
        const key = `${ord}|${p.genero}`;
        porOrdenanzaGenero.set(key, (porOrdenanzaGenero.get(key) ?? 0) + 1);
      }
    }

    return { transporte, hospedaje, porOrdenanzaGenero };
  }

  async cuposRestantes(viajeId: number): Promise<Record<string, number>> {
    const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');

    const ocupados = await this.cuposOcupados(viajeId);
    const restantes: Record<string, number> = {
      transporte: viaje.cuposTransporte - ocupados.transporte,
      hospedaje: viaje.cuposHospedaje - ocupados.hospedaje,
    };

    for (const ord of ORDENANZAS) {
      for (const genero of GENEROS) {
        const campo = campoCupoOrdenanza(ord, genero);
        const ocupado = ocupados.porOrdenanzaGenero.get(`${ord}|${genero}`) ?? 0;
        restantes[campo] = (viaje as unknown as Record<string, number>)[campo] - ocupado;
      }
    }

    return restantes;
  }

  async getViajeActivoPublico(): Promise<{
    id: number;
    fecha: string;
    fechaLimiteInscripcion: string;
    fechaConfirmada: boolean;
    incluyeTransporte: boolean;
    incluyeHospedaje: boolean;
    incluyeDesayuno: boolean;
    incluyeAlmuerzo: boolean;
    costoTransporte: number;
    costoDesayuno: number;
    costoAlmuerzo: number;
    inscripcionesAbiertas: boolean;
    cuposRestantes: Record<string, number>;
  }> {
    const viaje = await this.viajeRepo.findOne({ where: { activo: true } });
    if (!viaje) {
      throw new NotFoundException('No hay ningún viaje al templo activo en este momento.');
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const inscripcionesAbiertas = hoy <= viaje.fechaLimiteInscripcion;

    return {
      id: viaje.id,
      fecha: viaje.fecha,
      fechaLimiteInscripcion: viaje.fechaLimiteInscripcion,
      fechaConfirmada: viaje.fechaConfirmada,
      incluyeTransporte: viaje.incluyeTransporte,
      incluyeHospedaje: viaje.incluyeHospedaje,
      incluyeDesayuno: viaje.incluyeDesayuno,
      incluyeAlmuerzo: viaje.incluyeAlmuerzo,
      costoTransporte: parseFloat(viaje.costoTransporte),
      costoDesayuno: parseFloat(viaje.costoDesayuno),
      costoAlmuerzo: parseFloat(viaje.costoAlmuerzo),
      inscripcionesAbiertas,
      cuposRestantes: await this.cuposRestantes(viaje.id),
    };
  }

  async cedulaYaRegistrada(cedula: string): Promise<{ registrada: boolean }> {
    const normalizada = normalizarCedula(cedula);
    if (!normalizada) return { registrada: false };

    const viaje = await this.viajeRepo.findOne({ where: { activo: true } });
    if (!viaje) return { registrada: false };

    const existente = await this.participanteRepo
      .createQueryBuilder('p')
      .innerJoin('p.inscripcion', 'i')
      .where('i.viajeId = :viajeId', { viajeId: viaje.id })
      .getMany();

    const registrada = existente.some((p) => normalizarCedula(p.cedulaOPasaporte) === normalizada);
    return { registrada };
  }

  // ---------- Inscripciones ----------

  async crearInscripcion(dto: CreateInscripcionDto, ip: string | null): Promise<{ id: number }> {
    const viaje = await this.getViajeActivo();

    const hoy = new Date().toISOString().slice(0, 10);
    if (hoy > viaje.fechaLimiteInscripcion) {
      throw new BadRequestException('El plazo de inscripción para este viaje ya venció.');
    }

    return this.guardarInscripcion(viaje, dto, ip, 'público');
  }

  // Inscripción creada por Marco desde el panel admin — para cualquier
  // viaje (no solo el activo) y SIN el límite de fecha del formulario
  // público, ya que alguien puede pedirle que lo inscriba fuera de plazo.
  // Las demás reglas (cédula única, cupos, edad mínima) siguen aplicando.
  async crearInscripcionAdmin(dto: CreateInscripcionAdminDto): Promise<{ id: number }> {
    const viaje = await this.viajeRepo.findOne({ where: { id: dto.viajeId } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');

    return this.guardarInscripcion(viaje, dto, null, 'admin');
  }

  private async guardarInscripcion(
    viaje: TemploViaje,
    dto: { participantes: ParticipanteDto[]; consentimiento: boolean; policyVersion: string },
    ip: string | null,
    origen: 'público' | 'admin',
  ): Promise<{ id: number }> {
    this.validarEdadOrdenanzas(viaje, dto.participantes);
    await this.validarCedulasNoRepetidas(viaje.id, dto.participantes);
    await this.validarCupos(viaje, dto.participantes);

    const inscripcion = await this.inscripcionRepo.save(
      this.inscripcionRepo.create({
        viaje,
        ip,
        consentimiento: dto.consentimiento,
        policyVersion: dto.policyVersion,
      }),
    );

    const participantes = dto.participantes.map((p) =>
      this.participanteRepo.create({
        inscripcion,
        cedulaOPasaporte: normalizarCedula(p.cedulaOPasaporte),
        fechaNacimiento: p.fechaNacimiento,
        nombreCompleto: p.nombreCompleto,
        telefono: p.telefono,
        email: p.email,
        genero: p.genero,
        vaEnTransporte: p.vaEnTransporte,
        necesitaHospedaje: p.necesitaHospedaje,
        quiereDesayuno: p.quiereDesayuno,
        quiereAlmuerzo: p.quiereAlmuerzo,
        ordenanzas: p.ordenanzas.join(', '),
        costoTotal: this.calcularCostoTotal(viaje, p).toFixed(2),
      }),
    );
    await this.participanteRepo.save(participantes);

    await this.notificarNuevaInscripcion(dto.participantes, viaje, origen);

    return { id: inscripcion.id };
  }

  // Desayuno/almuerzo son opcionales por persona: solo se cobran si el viaje
  // los incluye Y el participante los quiere. Transporte solo a quien lo usa.
  // El total queda fijo en costoTotal del participante.
  private calcularCostoTotal(
    viaje: TemploViaje,
    p: Pick<ParticipanteDto, 'vaEnTransporte' | 'quiereDesayuno' | 'quiereAlmuerzo'>,
  ): number {
    let total = 0;
    if (viaje.incluyeDesayuno && p.quiereDesayuno) total += parseFloat(viaje.costoDesayuno);
    if (viaje.incluyeAlmuerzo && p.quiereAlmuerzo) total += parseFloat(viaje.costoAlmuerzo);
    if (p.vaEnTransporte) total += parseFloat(viaje.costoTransporte);
    return total;
  }

  // Un menor de 11 años no puede tener recomendación limitada del templo —
  // aunque el frontend ya deshabilita las ordenanzas para estos casos, se
  // revalida aquí porque el endpoint es público.
  private validarEdadOrdenanzas(viaje: TemploViaje, participantes: ParticipanteDto[]): void {
    for (const p of participantes) {
      if (p.ordenanzas.length === 0) continue;
      const edad = calcularEdad(p.fechaNacimiento, viaje.fecha);
      if (edad < EDAD_MINIMA_ORDENANZAS) {
        throw new BadRequestException(
          `${p.nombreCompleto} no tiene la edad mínima (${EDAD_MINIMA_ORDENANZAS} años) para participar en ordenanzas del templo.`,
        );
      }
    }
  }

  private async validarCedulasNoRepetidas(viajeId: number, participantes: ParticipanteDto[]): Promise<void> {
    const cedulas = participantes.map((p) => normalizarCedula(p.cedulaOPasaporte));
    if (cedulas.some((c) => c.length === 0)) {
      throw new BadRequestException('El número de cédula o pasaporte no es válido.');
    }

    const repetidaEnElEnvio = cedulas.find((c, i) => cedulas.indexOf(c) !== i);
    if (repetidaEnElEnvio) {
      throw new BadRequestException(
        `El número de cédula o pasaporte "${repetidaEnElEnvio}" está repetido en este mismo envío.`,
      );
    }

    const existentes = await this.participanteRepo
      .createQueryBuilder('p')
      .innerJoin('p.inscripcion', 'i')
      .where('i.viajeId = :viajeId', { viajeId })
      .getMany();

    const yaInscritas = new Set(existentes.map((p) => normalizarCedula(p.cedulaOPasaporte)));
    const duplicada = cedulas.find((c) => yaInscritas.has(c));
    if (duplicada) {
      throw new BadRequestException(
        `Ya existe un registro para este viaje con la cédula o pasaporte "${duplicada}". Si necesitas hacer un ` +
          'cambio, comunícate con la Presidencia del Quórum de Élderes o la Presidencia de la Sociedad de Socorro.',
      );
    }
  }

  private async validarCupos(viaje: TemploViaje, participantes: ParticipanteDto[]): Promise<void> {
    const ocupados = await this.cuposOcupados(viaje.id);

    let solicitadosTransporte = 0;
    let solicitadosHospedaje = 0;
    const solicitadosPorOrdenanzaGenero = new Map<string, number>();

    for (const p of participantes) {
      if (p.vaEnTransporte) solicitadosTransporte++;
      if (p.necesitaHospedaje) solicitadosHospedaje++;
      for (const ord of p.ordenanzas as Ordenanza[]) {
        const key = `${ord}|${p.genero as Genero}`;
        solicitadosPorOrdenanzaGenero.set(key, (solicitadosPorOrdenanzaGenero.get(key) ?? 0) + 1);
      }
    }

    if (ocupados.transporte + solicitadosTransporte > viaje.cuposTransporte) {
      throw new BadRequestException('Ya no hay cupos de transporte disponibles para este viaje.');
    }

    if (ocupados.hospedaje + solicitadosHospedaje > viaje.cuposHospedaje) {
      throw new BadRequestException('Ya no hay cupos de hospedaje disponibles para este viaje.');
    }

    for (const [key, solicitados] of solicitadosPorOrdenanzaGenero) {
      const [ord, genero] = key.split('|') as [Ordenanza, Genero];
      const campo = campoCupoOrdenanza(ord, genero);
      const cupoTotal = (viaje as unknown as Record<string, number>)[campo];
      const ocupado = ocupados.porOrdenanzaGenero.get(key) ?? 0;
      if (ocupado + solicitados > cupoTotal) {
        throw new BadRequestException(
          `Ya no hay cupos disponibles de ${ord} para ${genero === 'Hombre' ? 'hombres' : 'mujeres'} en este viaje.`,
        );
      }
    }
  }

  async aprobarParticipante(id: number, aprobado: boolean): Promise<TemploParticipante> {
    const participante = await this.participanteRepo.findOne({
      where: { id },
      relations: ['inscripcion', 'inscripcion.viaje'],
    });
    if (!participante) throw new NotFoundException('Participante no encontrado');

    if (aprobado && !participante.aprobado) {
      const viaje = participante.inscripcion.viaje;
      const ocupados = await this.cuposOcupados(viaje.id);

      if (participante.vaEnTransporte && ocupados.transporte + 1 > viaje.cuposTransporte) {
        throw new BadRequestException('Ya no hay cupos de transporte disponibles para este viaje.');
      }

      if (participante.necesitaHospedaje && ocupados.hospedaje + 1 > viaje.cuposHospedaje) {
        throw new BadRequestException('Ya no hay cupos de hospedaje disponibles para este viaje.');
      }

      const ordenanzas = participante.ordenanzas ? participante.ordenanzas.split(', ').filter(Boolean) : [];
      for (const ord of ordenanzas as Ordenanza[]) {
        const campo = campoCupoOrdenanza(ord, participante.genero as Genero);
        const cupoTotal = (viaje as unknown as Record<string, number>)[campo];
        const ocupado = ocupados.porOrdenanzaGenero.get(`${ord}|${participante.genero}`) ?? 0;
        if (ocupado + 1 > cupoTotal) {
          throw new BadRequestException(
            `Ya no hay cupos disponibles de ${ord} para ese género en este viaje — no se puede aprobar.`,
          );
        }
      }
    }

    participante.aprobado = aprobado;
    return this.participanteRepo.save(participante);
  }

  // Editar datos de un participante ya enviado (corrección de un dato mal
  // digitado, cambio de plan, etc.). Si ya está aprobado, se revalida el
  // cupo con los valores NUEVOS antes de guardar — excluyendo su propia
  // ocupación actual para no chocar consigo mismo.
  async actualizarParticipante(id: number, dto: UpdateParticipanteDto): Promise<TemploParticipante> {
    const participante = await this.participanteRepo.findOne({
      where: { id },
      relations: ['inscripcion', 'inscripcion.viaje'],
    });
    if (!participante) throw new NotFoundException('Participante no encontrado');

    const viaje = participante.inscripcion.viaje;

    let cedulaNormalizada: string | undefined;
    if (dto.cedulaOPasaporte !== undefined) {
      cedulaNormalizada = normalizarCedula(dto.cedulaOPasaporte);
      if (!cedulaNormalizada) {
        throw new BadRequestException('El número de cédula o pasaporte no es válido.');
      }
      const otros = await this.participanteRepo
        .createQueryBuilder('p')
        .innerJoin('p.inscripcion', 'i')
        .where('i.viajeId = :viajeId', { viajeId: viaje.id })
        .andWhere('p.id != :id', { id })
        .getMany();
      if (otros.some((p) => normalizarCedula(p.cedulaOPasaporte) === cedulaNormalizada)) {
        throw new BadRequestException(
          `Ya existe otro participante con la cédula o pasaporte "${cedulaNormalizada}" en este viaje.`,
        );
      }
    }

    const genero = dto.genero ?? participante.genero;
    const ordenanzas =
      dto.ordenanzas ?? (participante.ordenanzas ? participante.ordenanzas.split(', ').filter(Boolean) : []);
    const vaEnTransporte = dto.vaEnTransporte ?? participante.vaEnTransporte;
    const necesitaHospedaje = dto.necesitaHospedaje ?? participante.necesitaHospedaje;
    const quiereDesayuno = dto.quiereDesayuno ?? participante.quiereDesayuno;
    const quiereAlmuerzo = dto.quiereAlmuerzo ?? participante.quiereAlmuerzo;
    const fechaNacimiento = dto.fechaNacimiento ?? participante.fechaNacimiento;

    if (ordenanzas.length > 0) {
      const edad = calcularEdad(fechaNacimiento, viaje.fecha);
      if (edad < EDAD_MINIMA_ORDENANZAS) {
        throw new BadRequestException(
          `No tiene la edad mínima (${EDAD_MINIMA_ORDENANZAS} años) para participar en ordenanzas del templo.`,
        );
      }
    }

    if (participante.aprobado) {
      const ocupados = await this.cuposOcupados(viaje.id, participante.id);

      if (vaEnTransporte && ocupados.transporte + 1 > viaje.cuposTransporte) {
        throw new BadRequestException('Ya no hay cupos de transporte disponibles para este viaje.');
      }
      if (necesitaHospedaje && ocupados.hospedaje + 1 > viaje.cuposHospedaje) {
        throw new BadRequestException('Ya no hay cupos de hospedaje disponibles para este viaje.');
      }
      for (const ord of ordenanzas as Ordenanza[]) {
        const campo = campoCupoOrdenanza(ord, genero as Genero);
        const cupoTotal = (viaje as unknown as Record<string, number>)[campo];
        const ocupado = ocupados.porOrdenanzaGenero.get(`${ord}|${genero}`) ?? 0;
        if (ocupado + 1 > cupoTotal) {
          throw new BadRequestException(`Ya no hay cupos disponibles de ${ord} para ese género en este viaje.`);
        }
      }
    }

    if (cedulaNormalizada !== undefined) participante.cedulaOPasaporte = cedulaNormalizada;
    participante.fechaNacimiento = fechaNacimiento;
    if (dto.nombreCompleto !== undefined) participante.nombreCompleto = dto.nombreCompleto;
    if (dto.telefono !== undefined) participante.telefono = dto.telefono;
    if (dto.email !== undefined) participante.email = dto.email;
    participante.genero = genero;
    participante.vaEnTransporte = vaEnTransporte;
    participante.necesitaHospedaje = necesitaHospedaje;
    participante.quiereDesayuno = quiereDesayuno;
    participante.quiereAlmuerzo = quiereAlmuerzo;
    participante.ordenanzas = ordenanzas.join(', ');
    participante.costoTotal = this.calcularCostoTotal(viaje, { vaEnTransporte, quiereDesayuno, quiereAlmuerzo }).toFixed(2);

    return this.participanteRepo.save(participante);
  }

  // Marcar en vivo el día del viaje (subió al bus, se le entregó la comida)
  // — guardado directo, sin revalidar cupos: no afecta la aprobación.
  async actualizarLogistica(id: number, dto: ActualizarLogisticaDto): Promise<TemploParticipante> {
    const participante = await this.participanteRepo.findOne({ where: { id } });
    if (!participante) throw new NotFoundException('Participante no encontrado');

    if (dto.subioIda !== undefined) participante.subioIda = dto.subioIda;
    if (dto.subioRegreso !== undefined) participante.subioRegreso = dto.subioRegreso;
    if (dto.desayunoEntregado !== undefined) participante.desayunoEntregado = dto.desayunoEntregado;
    if (dto.almuerzoEntregado !== undefined) participante.almuerzoEntregado = dto.almuerzoEntregado;

    return this.participanteRepo.save(participante);
  }

  // A quién avisar cuando alguien se inscribe — no es un correo fijo, es
  // cualquier llamamiento con "Notificar" habilitado para viaje_templo en
  // la matriz de permisos (ver ModuloLlamamiento.puedeNotificar); llega por
  // correo a todos y además por Telegram a quien ya vinculó su cuenta.
  private async notificarNuevaInscripcion(
    participantesDto: ParticipanteDto[],
    viaje: TemploViaje,
    origen: 'público' | 'admin',
  ): Promise<void> {
    const nombres = participantesDto.map((p) => p.nombreCompleto).join(', ');
    const origenEtiqueta = origen === 'admin' ? ' — registrada desde el panel' : '';
    const cfg = await this.configAppService.load();

    await this.usuariosService.notificarEvento(
      'viaje_templo',
      `Nueva inscripción${origenEtiqueta} — Viaje para Adorar en el Templo (${nombres})`,
      buildInscripcionEmailHtml(participantesDto, cfg.nombreUnidad),
      `Nueva inscripción al Viaje al Templo${origenEtiqueta}: ${nombres}`,
    );
  }

  async listarInscripciones(): Promise<TemploInscripcion[]> {
    return this.inscripcionRepo.find({
      relations: [
        'participantes',
        'viaje',
        'participantes.abonos',
        'participantes.abonos.cobrador',
        'participantes.habitacion',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // ---------- Habitaciones del templo (hospedaje) ----------

  async listarHabitaciones(viajeId: number): Promise<TemploHabitacion[]> {
    return this.habitacionRepo.find({ where: { viaje: { id: viajeId } }, order: { numero: 'ASC' } });
  }

  async crearHabitacion(viajeId: number, dto: CreateHabitacionDto): Promise<TemploHabitacion> {
    const viaje = await this.viajeRepo.findOne({ where: { id: viajeId } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    if (!viaje.incluyeHospedaje) {
      throw new BadRequestException('Este viaje no incluye hospedaje — no hace falta gestionar habitaciones.');
    }
    return this.habitacionRepo.save(this.habitacionRepo.create({ viaje, numero: dto.numero }));
  }

  async eliminarHabitacion(id: number): Promise<void> {
    const resultado = await this.habitacionRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException('Habitación no encontrada');
  }

  async asignarHabitacion(participanteId: number, dto: AsignarHabitacionDto): Promise<TemploParticipante> {
    const participante = await this.participanteRepo.findOne({
      where: { id: participanteId },
      relations: ['inscripcion', 'inscripcion.viaje', 'habitacion'],
    });
    if (!participante) throw new NotFoundException('Participante no encontrado');

    if (dto.habitacionId === null || dto.habitacionId === undefined) {
      participante.habitacion = null;
      participante.rolHabitacion = null;
      return this.participanteRepo.save(participante);
    }

    const habitacion = await this.habitacionRepo.findOne({
      where: { id: dto.habitacionId },
      relations: ['viaje'],
    });
    if (!habitacion) throw new NotFoundException('Habitación no encontrada');
    if (habitacion.viaje.id !== participante.inscripcion.viaje.id) {
      throw new BadRequestException('Esa habitación pertenece a otro viaje.');
    }

    const ocupantes = await this.participanteRepo.count({
      where: { habitacion: { id: habitacion.id } },
    });
    const yaEstabaAqui = participante.habitacion?.id === habitacion.id;
    if (!yaEstabaAqui && ocupantes >= 6) {
      throw new BadRequestException(`La habitación ${habitacion.numero} ya tiene 6 personas asignadas.`);
    }

    const rolFinal = dto.rolHabitacion ?? participante.rolHabitacion ?? 'huesped';
    if (rolFinal === 'lider') {
      const yaEraLiderAqui = yaEstabaAqui && participante.rolHabitacion === 'lider';
      if (!yaEraLiderAqui) {
        const lideresActuales = await this.participanteRepo.count({
          where: { habitacion: { id: habitacion.id }, rolHabitacion: 'lider' },
        });
        if (lideresActuales >= 2) {
          throw new BadRequestException(`La habitación ${habitacion.numero} ya tiene 2 líderes asignados.`);
        }
      }
    }

    participante.habitacion = habitacion;
    participante.rolHabitacion = rolFinal;
    return this.participanteRepo.save(participante);
  }

  async actualizarDatosTemplo(id: number, dto: ActualizarDatosTemploDto): Promise<TemploParticipante> {
    const participante = await this.participanteRepo.findOne({ where: { id } });
    if (!participante) throw new NotFoundException('Participante no encontrado');
    if (dto.apellidos !== undefined) participante.apellidos = dto.apellidos;
    if (dto.nombres !== undefined) participante.nombres = dto.nombres;
    if (dto.nacionalidad !== undefined) participante.nacionalidad = dto.nacionalidad;
    return this.participanteRepo.save(participante);
  }

  private formatearFechaDiaMesAnio(fechaIso: string): string {
    const [anio, mes, dia] = fechaIso.split('-').map(Number);
    return `${dia}/${mes}/${anio}`;
  }

  // Excel exacto que se envía al templo: un bloque por habitación con
  // encabezado rosa, líderes primero y luego huéspedes numerados 1-6.
  // Apellidos/Nombres/Nacionalidad deben estar guardados de antemano — este
  // método no adivina nada, solo vuelca lo que ya se revisó y guardó.
  async generarExcelHabitaciones(viajeId: number): Promise<Buffer> {
    const habitaciones = await this.habitacionRepo.find({
      where: { viaje: { id: viajeId } },
      order: { numero: 'ASC' },
    });
    if (habitaciones.length === 0) {
      throw new BadRequestException('Este viaje no tiene habitaciones creadas todavía.');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Habitaciones');

    sheet.columns = [
      { width: 24 },
      { width: 28 },
      { width: 22 },
      { width: 20 },
      { width: 8 },
      { width: 14 },
      { width: 22 },
    ];

    for (const habitacion of habitaciones) {
      const ocupantes = await this.participanteRepo.find({ where: { habitacion: { id: habitacion.id } } });
      const lideres = ocupantes.filter((p) => p.rolHabitacion === 'lider');
      const huespedes = ocupantes.filter((p) => p.rolHabitacion !== 'lider');
      const ordenados = [...lideres, ...huespedes];

      const filaCabecera = sheet.addRow([
        `Habitación # ${habitacion.numero}`,
        'Correo electrónico',
        'Apellidos',
        'Nombres',
        'Sexo',
        'Nacionalidad',
        'F. Nacimiento día/mes/año',
      ]);
      filaCabecera.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2CEE2' } };
        cell.font = { bold: true, color: { argb: 'FF880E4F' } };
      });

      ordenados.forEach((p, index) => {
        const etiquetaRol = p.rolHabitacion === 'lider' ? 'Líder a cargo' : 'Huésped';
        sheet.addRow([
          `${index + 1}. ${etiquetaRol}`,
          p.email,
          p.apellidos ?? '',
          p.nombres ?? '',
          p.genero === 'Hombre' ? 'M' : 'F',
          p.nacionalidad ?? 'Ecuatoriana',
          this.formatearFechaDiaMesAnio(p.fechaNacimiento),
        ]);
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ---------- Cobradores (lista administrable de quién puede recibir pagos) ----------

  async listarCobradores(): Promise<TemploCobrador[]> {
    return this.cobradorRepo.find({ order: { nombre: 'ASC' } });
  }

  async crearCobrador(dto: CreateCobradorDto): Promise<TemploCobrador> {
    return this.cobradorRepo.save(this.cobradorRepo.create({ nombre: dto.nombre }));
  }

  async actualizarCobrador(id: number, dto: UpdateCobradorDto): Promise<TemploCobrador> {
    const cobrador = await this.cobradorRepo.findOne({ where: { id } });
    if (!cobrador) throw new NotFoundException('Cobrador no encontrado');
    if (dto.nombre !== undefined) cobrador.nombre = dto.nombre;
    if (dto.activo !== undefined) cobrador.activo = dto.activo;
    return this.cobradorRepo.save(cobrador);
  }

  // ---------- Abonos (referencial — no reemplaza la contabilidad oficial) ----------

  async crearAbono(participanteId: number, dto: CreateAbonoDto): Promise<TemploAbono> {
    const participante = await this.participanteRepo.findOne({ where: { id: participanteId } });
    if (!participante) throw new NotFoundException('Participante no encontrado');

    if (dto.tipo === 'pagado_persona' && !dto.cobradorId) {
      throw new BadRequestException('Selecciona a quién se le pagó.');
    }

    let cobrador: TemploCobrador | null = null;
    if (dto.cobradorId) {
      cobrador = await this.cobradorRepo.findOne({ where: { id: dto.cobradorId } });
      if (!cobrador) throw new NotFoundException('Cobrador no encontrado');
    }

    return this.abonoRepo.save(
      this.abonoRepo.create({
        participante,
        fecha: dto.fecha,
        valor: dto.valor.toFixed(2),
        tipo: dto.tipo,
        cobrador,
      }),
    );
  }

  async actualizarAbono(id: number, dto: UpdateAbonoDto): Promise<TemploAbono> {
    const abono = await this.abonoRepo.findOne({ where: { id }, relations: ['cobrador'] });
    if (!abono) throw new NotFoundException('Abono no encontrado');

    const tipoFinal = dto.tipo ?? abono.tipo;
    if (tipoFinal === 'pagado_persona') {
      const cobradorIdFinal = dto.cobradorId ?? abono.cobrador?.id;
      if (!cobradorIdFinal) throw new BadRequestException('Selecciona a quién se le pagó.');
      if (dto.cobradorId !== undefined) {
        const cobrador = await this.cobradorRepo.findOne({ where: { id: dto.cobradorId } });
        if (!cobrador) throw new NotFoundException('Cobrador no encontrado');
        abono.cobrador = cobrador;
      }
    } else if (tipoFinal === 'donativo_iglesia') {
      abono.cobrador = null;
    }

    if (dto.fecha !== undefined) abono.fecha = dto.fecha;
    if (dto.valor !== undefined) abono.valor = dto.valor.toFixed(2);
    if (dto.tipo !== undefined) abono.tipo = dto.tipo;

    return this.abonoRepo.save(abono);
  }

  async eliminarAbono(id: number): Promise<void> {
    const resultado = await this.abonoRepo.delete(id);
    if (resultado.affected === 0) throw new NotFoundException('Abono no encontrado');
  }
}
