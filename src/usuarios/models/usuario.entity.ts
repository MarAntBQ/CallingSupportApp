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

  @CreateDateColumn()
  createdAt: Date;
}
