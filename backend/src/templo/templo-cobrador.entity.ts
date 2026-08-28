import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Persona (hermano/hermana) que puede recibir pagos en efectivo por fuera
// del donativo al sistema de la Iglesia — lista que Marco Antonio administra
// él mismo, sin depender de un valor fijo en código.
@Entity('templo_cobradores')
export class TemploCobrador {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
