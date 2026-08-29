import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { EmailLog } from './email-log.entity';
import { buildBrandedEmailHtml } from './email-template';
import { ConfigAppService } from '../config/config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    private readonly configAppService: ConfigAppService,
  ) {}

  // Se reconstruye en cada envío a partir de la config vigente (BD, con
  // fallback a .env) — así un cambio desde el panel aplica de inmediato,
  // sin reiniciar el proceso (mismo criterio que TelegramBotService).
  private async getTransporter(): Promise<{ transporter: nodemailer.Transporter; user: string }> {
    const smtp = await this.configAppService.getSmtpEffective();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
    });
    return { transporter, user: smtp.user };
  }

  async send(
    source: string,
    opts: {
      to: string;
      subject: string;
      message: string;
      html?: string;
      cc?: string;
      preheader?: string;
      replyTo?: string;
    },
  ): Promise<{ sent: boolean; messageId?: string }> {
    const { to, subject, message, html, cc, preheader, replyTo } = opts;
    const cfg = await this.configAppService.load();
    const unitName = cfg.nombreUnidad || process.env.APP_NAME || 'CallingSupportApp';
    const centerHtml = html ?? `<p>${message.replace(/\n/g, '<br/>')}</p>`;
    const body = buildBrandedEmailHtml(subject, centerHtml, unitName, preheader ?? message);

    this.logger.log(`Enviando correo — source=${source} to=${to}${cc ? ` cc=${cc}` : ''} subject="${subject}"`);

    try {
      const { transporter, user } = await this.getTransporter();
      const info = await transporter.sendMail({
        from: `"${unitName}" <${user}>`,
        to,
        cc,
        replyTo,
        subject,
        html: body,
      });

      await this.emailLogRepository.save(
        this.emailLogRepository.create({ source, emailTo: to, emailSubject: subject, success: true }),
      );
      this.logger.log(`Correo enviado OK — source=${source} to=${to} messageId=${info.messageId}`);
      return { sent: true, messageId: info.messageId };
    } catch (error) {
      // No relanzar: un correo transaccional caído no debe tumbar el flujo que lo dispara
      // (registro, reset de contraseña, etc.) — igual que MailService.sendEmail en MarbustSystem.
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.emailLogRepository.save(
        this.emailLogRepository.create({ source, emailTo: to, emailSubject: subject, success: false, errorMessage }),
      );
      this.logger.error(`Fallo al enviar correo — source=${source} to=${to}: ${errorMessage}`);
      return { sent: false };
    }
  }

  async listLogs(limit = 200): Promise<EmailLog[]> {
    return this.emailLogRepository.find({ order: { id: 'DESC' }, take: limit });
  }
}
