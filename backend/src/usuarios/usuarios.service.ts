import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Role } from './models/role.entity';
import { Organizacion } from './models/organizacion.entity';
import { Usuario } from './models/usuario.entity';
import { UsuarioOrganizacion } from './models/usuario-organizacion.entity';
import { ModuloOrganizacion } from './models/modulo-organizacion.entity';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { SetModuloOrganizacionesDto } from './dto/set-modulo-organizaciones.dto';
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
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(UsuarioOrganizacion)
    private readonly usuarioOrgRepo: Repository<UsuarioOrganizacion>,
    @InjectRepository(ModuloOrganizacion)
    private readonly moduloOrgRepo: Repository<ModuloOrganizacion>,
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

    if (dto.organizacionIds?.length) {
      for (const organizacionId of dto.organizacionIds) {
        await this.usuarioOrgRepo.save(this.usuarioOrgRepo.create({ usuarioId: usuario.id, organizacionId }));
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

  async listarUsuarios() {
    const usuarios = await this.usuarioRepo.find({ relations: ['role'], order: { apellidos: 'ASC' } });
    const filas = await this.usuarioOrgRepo.find({ relations: ['organizacion'] });
    return usuarios.map((u) => ({
      ...sanitizarUsuario(u),
      organizaciones: filas.filter((f) => f.usuarioId === u.id).map((f) => f.organizacion),
    }));
  }

  async actualizarUsuario(id: number, dto: UpdateUsuarioDto) {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (dto.roleId !== undefined) usuario.roleId = dto.roleId;
    if (dto.estado !== undefined) usuario.estado = dto.estado;
    if (dto.llamamiento !== undefined) usuario.llamamiento = dto.llamamiento;
    await this.usuarioRepo.save(usuario);

    if (dto.organizacionIds !== undefined) {
      await this.usuarioOrgRepo.delete({ usuarioId: id });
      for (const organizacionId of dto.organizacionIds) {
        await this.usuarioOrgRepo.save(this.usuarioOrgRepo.create({ usuarioId: id, organizacionId }));
      }
    }

    const actualizado = (await this.usuarioRepo.findOne({ where: { id }, relations: ['role'] })) as Usuario;
    return sanitizarUsuario(actualizado);
  }

  // Consejo de barrio: quién lidera cada organización — para que Obispado/
  // SuperAdmin vean de un vistazo la estructura, no solo la lista plana de
  // usuarios. Incluye Obispado además de Líder porque en algunos barrios el
  // obispado mismo preside una organización (ej. Hombres Jóvenes).
  async listarConsejoBarrio() {
    const organizaciones = await this.organizacionRepo.find({ order: { nombre: 'ASC' } });
    const filas = await this.usuarioOrgRepo.find({ relations: ['usuario', 'usuario.role'] });

    return organizaciones.map((organizacion) => ({
      organizacion,
      lideres: filas
        .filter(
          (f) =>
            f.organizacionId === organizacion.id &&
            (f.usuario.role.nombre === 'Líder' || f.usuario.role.nombre === 'Obispado'),
        )
        .map((f) => sanitizarUsuario(f.usuario)),
    }));
  }

  async organizacionesDeUsuario(id: number): Promise<Organizacion[]> {
    const filas = await this.usuarioOrgRepo.find({ where: { usuarioId: id }, relations: ['organizacion'] });
    return filas.map((f) => f.organizacion);
  }

  // Todos los módulos con al menos una organización mapeada — agrupado por
  // moduloClave, para la pantalla "Permisos de módulos".
  async listarModuloOrganizaciones(): Promise<Record<string, Organizacion[]>> {
    const filas = await this.moduloOrgRepo.find({ relations: ['organizacion'] });
    const agrupado: Record<string, Organizacion[]> = {};
    for (const fila of filas) {
      agrupado[fila.moduloClave] ??= [];
      agrupado[fila.moduloClave].push(fila.organizacion);
    }
    return agrupado;
  }

  // Reemplaza el set completo de organizaciones habilitadas para un módulo.
  async fijarModuloOrganizaciones(dto: SetModuloOrganizacionesDto): Promise<void> {
    await this.moduloOrgRepo.delete({ moduloClave: dto.moduloClave });
    for (const organizacionId of dto.organizacionIds) {
      await this.moduloOrgRepo.save(this.moduloOrgRepo.create({ moduloClave: dto.moduloClave, organizacionId }));
    }
  }
}
