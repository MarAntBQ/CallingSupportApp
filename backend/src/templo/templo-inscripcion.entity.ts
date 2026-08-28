import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TemploParticipante } from './templo-participante.entity';
import { TemploViaje } from './templo-viaje.entity';

@Entity('templo_inscripciones')
export class TemploInscripcion {
  @PrimaryGeneratedColumn()
  id: number;

  // Una inscripción pertenece a UN viaje específico — no aplica a viajes
  // futuros, hay que inscribirse de nuevo cada vez.
  @ManyToOne(() => TemploViaje, { nullable: false })
  viaje: TemploViaje;

  @OneToMany(() => TemploParticipante, (p) => p.inscripcion, { cascade: true })
  participantes: TemploParticipante[];

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  // Consentimiento explícito registrado (art. 8 LOPDP) — createdAt sirve de
  // marca temporal de cuándo se otorgó, junto con qué versión de la política.
  @Column({ default: true })
  consentimiento: boolean;

  @Column()
  policyVersion: string;

  @CreateDateColumn()
  createdAt: Date;
}
