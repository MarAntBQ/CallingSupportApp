import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role.entity';

export type EstadoUsuario = 'pendiente' | 'activo' | 'suspendido';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombres: string;

  @Column()
  apellidos: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  telefono: string | null;

  @Column()
  passwordHash: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column()
  roleId: number;

  // Cargo específico dentro del rol/organización (ej. "Obispo", "1er
  // consejero", "Presidenta", "Secretario auxiliar — Finanzas") — el rol
  // (SuperAdmin/Obispado/Líder/...) decide el NIVEL de acceso, esto es solo
  // para mostrar quién es quién; texto libre porque cada barrio nombra sus
  // llamamientos distinto.
  @Column({ type: 'varchar', nullable: true })
  llamamiento: string | null;

  @Column({ type: 'varchar', default: 'pendiente' })
  estado: EstadoUsuario;

  // Verificación de correo al registrarse.
  @Column({ type: 'varchar', nullable: true })
  otpCode: string | null;

  @Column({ default: 0 })
  otpTries: number;

  // Recuperación de contraseña.
  @Column({ type: 'varchar', nullable: true })
  resetOtpCode: string | null;

  @Column({ default: 0 })
  resetOtpTries: number;

  @Column({ default: false })
  resetOtpVerified: boolean;

  // Vinculación con Telegram para notificaciones (ver ModuloLlamamiento.
  // puedeNotificar) — telegramLinkCode es temporal mientras la persona no
  // ha abierto el enlace del bot; una vez que lo hace, queda telegramChatId
  // y el código se limpia.
  @Column({ type: 'varchar', nullable: true })
  telegramChatId: string | null;

  @Column({ type: 'varchar', nullable: true })
  telegramLinkCode: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
