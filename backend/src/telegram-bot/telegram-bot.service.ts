import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../usuarios/models/usuario.entity';
import { ConfigAppService } from '../core/config/config.service';

// Bot de Telegram para notificaciones (ver ModuloLlamamiento.puedeNotificar)
// — cada usuario vincula SU chat desde su perfil (enlace con /start
// <código>, ver AuthService.vincularTelegram); este servicio solo escucha
// esos /start por long-polling (sin webhook, sin dependencia externa —
// Node 20 trae fetch nativo) y envía mensajes cuando se lo pidan. El token
// vive cifrado en la BD (ver ConfigAppService.getTelegramBotToken), nunca
// en .env — cada vuelta del loop lo relee, así que si el Obispado lo
// configura mientras el proceso ya está corriendo, se activa solo, sin
// reiniciar nada.
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private offset = 0;
  private detenido = false;

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    private readonly configAppService: ConfigAppService,
  ) {}

  onModuleInit(): void {
    void this.iniciarPolling();
  }

  onModuleDestroy(): void {
    this.detenido = true;
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    const token = await this.configAppService.getTelegramBotToken();
    if (!token) return;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (err) {
      this.logger.error(`Fallo al enviar mensaje de Telegram a ${chatId}: ${(err as Error).message}`);
    }
  }

  private async iniciarPolling(): Promise<void> {
    while (!this.detenido) {
      const token = await this.configAppService.getTelegramBotToken();
      if (!token) {
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }
      try {
        const resp = await fetch(
          `https://api.telegram.org/bot${token}/getUpdates?timeout=30&offset=${this.offset}`,
        );
        const data = (await resp.json()) as {
          ok: boolean;
          result: { update_id: number; message?: { chat: { id: number }; text?: string } }[];
        };
        if (data.ok) {
          for (const update of data.result) {
            this.offset = update.update_id + 1;
            const mensaje = update.message;
            if (mensaje?.text) await this.procesarMensaje(token, String(mensaje.chat.id), mensaje.text);
          }
        } else {
          // token inválido/revocado — no insistir en loop cerrado.
          await new Promise((r) => setTimeout(r, 15_000));
        }
      } catch (err) {
        this.logger.error(`Error consultando getUpdates: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async procesarMensaje(token: string, chatId: string, texto: string): Promise<void> {
    const match = texto.trim().match(/^\/start(?:\s+(\S+))?$/);
    if (!match) return;

    const send = (text: string) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });

    const codigo = match[1];
    if (!codigo) {
      await send('Para vincular tu cuenta, usa el enlace que aparece en tu perfil del sistema.');
      return;
    }

    const usuario = await this.usuarioRepo.findOne({ where: { telegramLinkCode: codigo } });
    if (!usuario) {
      await send('Ese código ya no es válido — genera uno nuevo desde tu perfil.');
      return;
    }

    usuario.telegramChatId = chatId;
    usuario.telegramLinkCode = null;
    await this.usuarioRepo.save(usuario);
    await send(`Listo, ${usuario.nombres} — tu cuenta quedó vinculada. Aquí recibirás avisos.`);
  }
}
