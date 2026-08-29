import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfig } from './config.entity';
import { encryptToBase64, decryptFromBase64 } from '../crypto/aes.util';

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

  // El token se recibe una sola vez desde el panel y se guarda cifrado —
  // nunca se vuelve a mostrar en texto plano (mismo criterio que
  // restablecerPassword: se ve una vez, después solo se puede reemplazar).
  async setTelegramBot(botToken: string, botUsername: string): Promise<void> {
    const cfg = await this.load();
    cfg.telegramBotTokenEnc = encryptToBase64(botToken);
    cfg.telegramBotUsername = botUsername;
    await this.configRepo.save(cfg);
  }

  async getTelegramBotToken(): Promise<string | null> {
    const cfg = await this.load();
    if (!cfg.telegramBotTokenEnc) return null;
    return decryptFromBase64(cfg.telegramBotTokenEnc);
  }

  async getTelegramBotUsername(): Promise<string | null> {
    const cfg = await this.load();
    return cfg.telegramBotUsername;
  }
}
