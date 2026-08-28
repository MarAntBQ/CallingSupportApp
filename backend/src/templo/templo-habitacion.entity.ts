import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TemploViaje } from './templo-viaje.entity';

// Habitación real del templo (6 personas) para el viaje — Marco Antonio
// ingresa el número tal cual se lo asignan (ej. "206"), no es secuencial.
@Entity('templo_habitaciones')
export class TemploHabitacion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TemploViaje, { onDelete: 'CASCADE' })
  @JoinColumn()
  viaje: TemploViaje;

  @Column()
  numero: string;

  @CreateDateColumn()
  createdAt: Date;
}
