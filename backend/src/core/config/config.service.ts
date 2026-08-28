import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './config.entity';

@Injectable()
export class ConfigAppService implements OnModuleInit {
  constructor(
    @InjectRepository(AppConfig)
    private readonly configRepo: Repository<AppConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.configRepo.find({ take: 1 });
    if (existing.length === 0) {
      await this.configRepo.save(this.configRepo.create({ permitirRegistro: false, nombreUnidad: '' }));
    }
  }

  async load(): Promise<AppConfig> {
    const rows = await this.configRepo.find({ order: { id: 'ASC' }, take: 1 });
    return rows[0];
  }

  async update(changes: Partial<Pick<AppConfig, 'permitirRegistro' | 'nombreUnidad'>>): Promise<AppConfig> {
    const cfg = await this.load();
    Object.assign(cfg, changes);
    return this.configRepo.save(cfg);
  }
}
