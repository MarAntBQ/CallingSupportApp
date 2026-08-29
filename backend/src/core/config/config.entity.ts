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
}
