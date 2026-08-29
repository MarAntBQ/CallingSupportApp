import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Fila única (siempre id=1) — mismo patrón usado en otros proyectos de Marco
// Antonio para configuración global editable desde una pantalla de admin.
@Entity('config')
export class AppConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  permitirRegistro: boolean;

  @Column({ default: '' })
  nombreUnidad: string;

  // El token del bot NUNCA se guarda en texto plano ni en .env — solo
  // cifrado (ver core/crypto/aes.util) con la llave maestra ENC_KEY.
  @Column({ type: 'text', nullable: true })
  telegramBotTokenEnc: string | null;

  @Column({ type: 'varchar', nullable: true })
  telegramBotUsername: string | null;

  // Logo del barrio — se guarda como data URL completa (data:image/png;
  // base64,...) para poder mostrarlo directo en un <img src>, sin archivo
  // en disco. No es secreto, va también en la respuesta pública de /config.
  @Column({ type: 'mediumtext', nullable: true })
  logoDataUrl: string | null;

  // Servidor de correo (SMTP) — la contraseña nunca en texto plano ni en
  // .env, solo cifrada (igual que el token de Telegram). Si no se
  // configura acá, MailService cae de vuelta a las variables NODEMAILER_*
  // de .env (compatibilidad con despliegues existentes).
  @Column({ type: 'varchar', nullable: true })
  smtpHost: string | null;

  @Column({ type: 'int', nullable: true })
  smtpPort: number | null;

  @Column({ default: false })
  smtpSecure: boolean;

  @Column({ type: 'varchar', nullable: true })
  smtpUser: string | null;

  @Column({ type: 'text', nullable: true })
  smtpPasswordEnc: string | null;
}
