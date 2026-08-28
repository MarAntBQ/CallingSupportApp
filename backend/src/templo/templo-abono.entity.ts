import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TemploParticipante } from './templo-participante.entity';
import { TemploCobrador } from './templo-cobrador.entity';

// Registro referencial de pagos — no reemplaza la contabilidad oficial del
// barrio, solo ayuda a saber cuánto falta por cobrar y cuánto efectivo tiene
// cada hermano que recibió pagos, para que lo entregue completo.
@Entity('templo_abonos')
export class TemploAbono {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TemploParticipante, { onDelete: 'CASCADE' })
  @JoinColumn()
  participante: TemploParticipante;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: string;

  // 'donativo_iglesia' | 'pagado_persona'
  @Column({ type: 'varchar' })
  tipo: string;

  // Solo aplica cuando tipo = 'pagado_persona'.
  @ManyToOne(() => TemploCobrador, { nullable: true })
  @JoinColumn()
  cobrador: TemploCobrador | null;

  @CreateDateColumn()
  createdAt: Date;
}
