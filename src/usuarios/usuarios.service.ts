import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './models/role.entity';
import { Organizacion } from './models/organizacion.entity';
import { Usuario } from './models/usuario.entity';
import { UsuarioOrganizacion } from './models/usuario-organizacion.entity';
import { ModuloOrganizacion } from './models/modulo-organizacion.entity';
import { CreateOrganizacionDto } from './dto/create-organizacion.dto';
import { UpdateOrganizacionDto } from './dto/update-organizacion.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { SetModuloOrganizacionesDto } from './dto/set-modulo-organizaciones.dto';

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
  ) {}

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

  async listarUsuarios(): Promise<Usuario[]> {
    return this.usuarioRepo.find({ relations: ['role'], order: { apellidos: 'ASC' } });
  }

  async actualizarUsuario(id: number, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (dto.roleId !== undefined) usuario.roleId = dto.roleId;
    if (dto.estado !== undefined) usuario.estado = dto.estado;
    await this.usuarioRepo.save(usuario);

    if (dto.organizacionIds !== undefined) {
      await this.usuarioOrgRepo.delete({ usuarioId: id });
      for (const organizacionId of dto.organizacionIds) {
        await this.usuarioOrgRepo.save(this.usuarioOrgRepo.create({ usuarioId: id, organizacionId }));
      }
    }

    return this.usuarioRepo.findOne({ where: { id }, relations: ['role'] }) as Promise<Usuario>;
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
