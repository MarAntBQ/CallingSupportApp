import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
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

  async getTelegramBotSummary(): Promise<{ botUsername: string | null; hasToken: boolean }> {
    const cfg = await this.load();
    return { botUsername: cfg.telegramBotUsername, hasToken: !!cfg.telegramBotTokenEnc };
  }

  async setLogo(logoDataUrl: string | null): Promise<void> {
    const cfg = await this.load();
    cfg.logoDataUrl = logoDataUrl;
    await this.configRepo.save(cfg);
  }

  // La contraseña es opcional al actualizar — si no viene, se conserva la
  // que ya estaba cifrada (así se puede corregir el host/usuario sin tener
  // que volver a escribir la contraseña cada vez).
  async setSmtp(opts: { host: string; port: number; secure: boolean; user: string; password?: string }): Promise<void> {
    const cfg = await this.load();
    cfg.smtpHost = opts.host;
    cfg.smtpPort = opts.port;
    cfg.smtpSecure = opts.secure;
    cfg.smtpUser = opts.user;
    if (opts.password) cfg.smtpPasswordEnc = encryptToBase64(opts.password);
    await this.configRepo.save(cfg);
  }

  async getSmtpSummary(): Promise<{
    host: string | null;
    port: number | null;
    secure: boolean;
    user: string | null;
    hasPassword: boolean;
  }> {
    const cfg = await this.load();
    return { host: cfg.smtpHost, port: cfg.smtpPort, secure: cfg.smtpSecure, user: cfg.smtpUser, hasPassword: !!cfg.smtpPasswordEnc };
  }

  // Config efectiva para enviar correo — si no hay nada guardado en BD,
  // cae de vuelta a las variables NODEMAILER_* de .env (despliegues que
  // todavía no migraron a configurarlo desde el panel).
  async getSmtpEffective(): Promise<{ host: string; port: number; secure: boolean; user: string; password: string }> {
    const cfg = await this.load();
    if (cfg.smtpHost && cfg.smtpPasswordEnc) {
      return {
        host: cfg.smtpHost,
        port: cfg.smtpPort ?? 587,
        secure: cfg.smtpSecure,
        user: cfg.smtpUser ?? '',
        password: decryptFromBase64(cfg.smtpPasswordEnc),
      };
    }
    return {
      host: process.env.NODEMAILER_HOST ?? '',
      port: process.env.NODEMAILER_PORT ? parseInt(process.env.NODEMAILER_PORT, 10) : 587,
      secure: process.env.NODEMAILER_SECURE === 'true',
      user: process.env.NODEMAILER_USER ?? '',
      password: process.env.NODEMAILER_PASSWORD ?? '',
    };
  }

  // Envía de verdad con la config vigente (BD o .env) — para que el admin
  // pueda confirmar que lo que guardó funciona, sin tener que disparar un
  // flujo real (registro, inscripción, etc.) para probarlo.
  async sendTestEmail(to: string): Promise<void> {
    const cfg = await this.load();
    const smtp = await this.getSmtpEffective();
    if (!smtp.host || !smtp.user) throw new BadRequestException('No hay servidor de correo configurado.');
    const unitName = cfg.nombreUnidad || 'CallingSupportApp';
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
    });
    try {
      await transporter.sendMail({
        from: `"${unitName}" <${smtp.user}>`,
        to,
        subject: 'Correo de prueba',
        html: '<p>Si ves este correo, la configuración del servidor de correo funciona correctamente.</p>',
      });
    } catch (err) {
      throw new BadRequestException(`No se pudo enviar: ${(err as Error).message}`);
    }
  }

  // Igual criterio — confirma que el token es válido y el bot existe, sin
  // depender de que alguien ya haya vinculado su Telegram para probarlo.
  async testTelegramBot(): Promise<{ botUsername: string }> {
    const token = await this.getTelegramBotToken();
    if (!token) throw new BadRequestException('No hay token de Telegram configurado.');
    let data: { ok: boolean; result?: { username: string }; description?: string };
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      data = await resp.json();
    } catch (err) {
      throw new BadRequestException(`No se pudo contactar a Telegram: ${(err as Error).message}`);
    }
    if (!data.ok || !data.result) {
      throw new BadRequestException(data.description || 'El token no es válido.');
    }
    return { botUsername: data.result.username };
  }
}
