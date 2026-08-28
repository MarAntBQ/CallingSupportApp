import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, ROLES_SEED } from './models/role.entity';
import { Organizacion, ORGANIZACIONES_SEED } from './models/organizacion.entity';

@Injectable()
export class UsuariosSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Organizacion)
    private readonly organizacionRepo: Repository<Organizacion>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const rol of ROLES_SEED) {
      const existe = await this.roleRepo.findOne({ where: { nombre: rol.nombre } });
      if (!existe) await this.roleRepo.save(this.roleRepo.create(rol));
    }
    for (const nombre of ORGANIZACIONES_SEED) {
      const existe = await this.organizacionRepo.findOne({ where: { nombre } });
      if (!existe) await this.organizacionRepo.save(this.organizacionRepo.create({ nombre }));
    }
  }
}
