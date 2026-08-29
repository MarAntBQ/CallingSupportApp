import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Role } from './models/role.entity';
import { Organizacion } from './models/organizacion.entity';
import { Usuario } from './models/usuario.entity';
import { Llamamiento } from './models/llamamiento.entity';
import { UsuarioLlamamiento } from './models/usuario-llamamiento.entity';
import { ModuloLlamamiento } from './models/modulo-llamamiento.entity';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { CreateLlamamientoDto } from './dto/create-llamamiento.dto';
import { UpdateLlamamientoDto } from './dto/update-llamamiento.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { SetModuloLlamamientosDto } from './dto/set-modulo-llamamientos.dto';
import { HashPasswordsService } from '../core/hash-passwords/hash-passwords.service';
import { MailService } from '../core/mail/mail.service';

function passwordTemporal(length = 14): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alfabeto[bytes[i] % alfabeto.length];
  return out;
}

// El admin panel lista/edita usuarios — nunca debe viajar el hash de la
// contraseña ni los códigos OTP en la respuesta JSON.
function sanitizarUsuario<T extends Usuario>(
  u: T,
): Omit<T, 'passwordHash' | 'otpCode' | 'otpTries' | 'resetOtpCode' | 'resetOtpTries' | 'resetOtpVerified'> {
  const { passwordHash, otpCode, otpTries, resetOtpCode, resetOtpTries, resetOtpVerified, ...resto } = u;
  return resto;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Organizacion)
    private readonly organizacionRepo: Repository<Organizacion>,
    @InjectRepository(Llamamiento)
    private readonly llamamientoRepo: Repository<Llamamiento>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(UsuarioLlamamiento)
    private readonly usuarioLlamamientoRepo: Repository<UsuarioLlamamiento>,
    @InjectRepository(ModuloLlamamiento)
    private readonly moduloLlamamientoRepo: Repository<ModuloLlamamiento>,
    private readonly hashPasswordsService: HashPasswordsService,
    private readonly mailService: MailService,
  ) {}

  async crearUsuario(dto: CreateUsuarioDto) {
    const existente = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    if (existente) throw new BadRequestException('Ya existe una cuenta con ese correo.');

    const password = passwordTemporal();
    const passwordHash = await this.hashPasswordsService.hashPassword(password);

    const usuario = await this.usuarioRepo.save(
      this.usuarioRepo.create({
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        email: dto.email,
        telefono: dto.telefono ?? null,
        passwordHash,
        roleId: dto.roleId,
        estado: 'activo',
        llamamiento: dto.llamamiento ?? null,
      }),
    );

    if (dto.llamamientoIds?.length) {
      for (const llamamientoId of dto.llamamientoIds) {
        await this.usuarioLlamamientoRepo.save(this.usuarioLlamamientoRepo.create({ usuarioId: usuario.id, llamamientoId }));
      }
    }

    await this.mailService.send('auth-admin-crea-usuario', {
      to: dto.email,
      subject: 'Se creó una cuenta para ti',
      message: `Se creó una cuenta a tu nombre. Correo: ${dto.email}. Contraseña temporal: ${password}. Te recomendamos cambiarla apenas inicies sesión.`,
      html: `<h2>Se creó una cuenta para ti</h2><p>Correo: <strong>${dto.email}</strong></p><p>Contraseña temporal: <strong>${password}</strong></p><p>Te recomendamos cambiarla apenas inicies sesión.</p>`,
    });

    const conRole = (await this.usuarioRepo.findOne({ where: { id: usuario.id }, relations: ['role'] })) as Usuario;
    return sanitizarUsuario(conRole);
  }

  listarRoles(): Promise<Role[]> {
    return this.roleRepo.find({ order: { nivel: 'DESC' } });
  }

  listarOrganizaciones(): Promise<Organizacion[]> {
    return this.organizacionRepo.find({ order: { nombre: 'ASC' } });
  }

  async crearOrganizacion(dto: CreateOrganizacionDto): Promise<Organizacion> {
    const existe = await this.organizacionRepo.findOne({ where: { nombre: dto.nombre } });
    if (existe) throw new BadRequestException('Ya existe una organización con ese nombre.');
    return this.organizacionRepo.save(this.organizacionRepo.create(dto));
  }

  async actualizarOrganizacion(id: number, dto: UpdateOrganizacionDto): Promise<Organizacion> {
    const organizacion = await this.organizacionRepo.findOne({ where: { id } });
    if (!organizacion) throw new NotFoundException('Organización no encontrada.');
    Object.assign(organizacion, dto);
    return this.organizacionRepo.save(organizacion);
  }

  // Catálogo de llamamientos — cada organización crea los suyos (ej.
  // Obispado: "Obispo", "Secretario Financiero"). Los permisos de cada
  // módulo se otorgan sobre un llamamiento puntual, no sobre la
  // organización completa (ver ModuloLlamamiento).
  listarLlamamientos(): Promise<Llamamiento[]> {
    return this.llamamientoRepo.find({ relations: ['organizacion'], order: { organizacionId: 'ASC', nombre: 'ASC' } });
  }

  async crearLlamamiento(dto: CreateLlamamientoDto): Promise<Llamamiento> {
    const existe = await this.llamamientoRepo.findOne({ where: { organizacionId: dto.organizacionId, nombre: dto.nombre } });
    if (existe) throw new BadRequestException('Ya existe un llamamiento con ese nombre en esa organización.');
    return this.llamamientoRepo.save(this.llamamientoRepo.create(dto));
  }

  async actualizarLlamamiento(id: number, dto: UpdateLlamamientoDto): Promise<Llamamiento> {
    const llamamiento = await this.llamamientoRepo.findOne({ where: { id } });
    if (!llamamiento) throw new NotFoundException('Llamamiento no encontrado.');
    Object.assign(llamamiento, dto);
    return this.llamamientoRepo.save(llamamiento);
  }

  async listarUsuarios() {
    const usuarios = await this.usuarioRepo.find({ relations: ['role'], order: { apellidos: 'ASC' } });
    const filas = await this.usuarioLlamamientoRepo.find({ relations: ['llamamiento', 'llamamiento.organizacion'] });
    return usuarios.map((u) => {
      const propios = filas.filter((f) => f.usuarioId === u.id).map((f) => f.llamamiento);
      return {
        ...sanitizarUsuario(u),
        llamamientos: propios,
        organizaciones: [...new Map(propios.map((l) => [l.organizacion.id, l.organizacion])).values()],
      };
    });
  }

  async actualizarUsuario(id: number, dto: UpdateUsuarioDto) {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (dto.roleId !== undefined) usuario.roleId = dto.roleId;
    if (dto.estado !== undefined) usuario.estado = dto.estado;
    if (dto.llamamiento !== undefined) usuario.llamamiento = dto.llamamiento;
    await this.usuarioRepo.save(usuario);

    if (dto.llamamientoIds !== undefined) {
      await this.usuarioLlamamientoRepo.delete({ usuarioId: id });
      for (const llamamientoId of dto.llamamientoIds) {
        await this.usuarioLlamamientoRepo.save(this.usuarioLlamamientoRepo.create({ usuarioId: id, llamamientoId }));
      }
    }

    const actualizado = (await this.usuarioRepo.findOne({ where: { id }, relations: ['role'] })) as Usuario;
    return sanitizarUsuario(actualizado);
  }

  // Genera una contraseña temporal nueva y la devuelve UNA sola vez en la
  // respuesta — nunca se guarda en texto plano, solo el admin la ve para
  // entregársela en persona a la persona (ver [[mbrelax-dist... ]] — regla
  // dura del proyecto: prohibido enviarla por correo a cuentas reales de
  // barrio, el admin la entrega directamente).
  async restablecerPassword(id: number): Promise<{ password: string }> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    const password = passwordTemporal();
    usuario.passwordHash = await this.hashPasswordsService.hashPassword(password);
    await this.usuarioRepo.save(usuario);
    return { password };
  }

  // Consejo de barrio: quién lidera cada organización — para que Obispado/
  // SuperAdmin vean de un vistazo la estructura, no solo la lista plana de
  // usuarios. La organización de cada persona se deriva de sus llamamientos.
  async listarConsejoBarrio() {
    const organizaciones = await this.organizacionRepo.find({ order: { nombre: 'ASC' } });
    const filas = await this.usuarioLlamamientoRepo.find({
      relations: ['usuario', 'usuario.role', 'llamamiento'],
    });

    return organizaciones.map((organizacion) => ({
      organizacion,
      lideres: filas
        .filter((f) => f.llamamiento.organizacionId === organizacion.id)
        .map((f) => ({ ...sanitizarUsuario(f.usuario), llamamiento: f.llamamiento.nombre })),
    }));
  }

  // Todos los módulos con al menos un llamamiento con permiso — agrupado por
  // moduloClave, para la pantalla "Permisos de módulos". Cada fila incluye
  // los 4 permisos (leer/crear/editar/eliminar) de un llamamiento puntual.
  async listarModuloLlamamientos(): Promise<Record<string, ModuloLlamamiento[]>> {
    const filas = await this.moduloLlamamientoRepo.find({ relations: ['llamamiento', 'llamamiento.organizacion'] });
    const agrupado: Record<string, ModuloLlamamiento[]> = {};
    for (const fila of filas) {
      agrupado[fila.moduloClave] ??= [];
      agrupado[fila.moduloClave].push(fila);
    }
    return agrupado;
  }

  // Reemplaza el set completo de permisos del módulo.
  async fijarModuloLlamamientos(dto: SetModuloLlamamientosDto): Promise<void> {
    await this.moduloLlamamientoRepo.delete({ moduloClave: dto.moduloClave });
    for (const permiso of dto.permisos) {
      await this.moduloLlamamientoRepo.save(this.moduloLlamamientoRepo.create({ moduloClave: dto.moduloClave, ...permiso }));
    }
  }
}
