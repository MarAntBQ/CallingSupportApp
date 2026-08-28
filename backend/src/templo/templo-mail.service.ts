import { Injectable } from '@nestjs/common';
import { MailService } from '../core/mail/mail.service';

// Delega al MailService genérico (mismas credenciales SMTP de toda la app)
// en vez de tener su propio transportador — un solo set de credenciales de
// correo por despliegue, más simple para cualquier barrio que use este proyecto.
@Injectable()
export class TemploMailService {
  constructor(private readonly mailService: MailService) {}

  async send(to: string, subject: string, html: string): Promise<void> {
    await this.mailService.send('templo', { to, subject, message: subject, html });
  }
}
