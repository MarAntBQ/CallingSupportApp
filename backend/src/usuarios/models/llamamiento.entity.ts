import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organizacion } from './organizacion.entity';

// Catálogo de cargos dentro de una organización (ej. Obispado: "Obispo",
// "1er consejero", "Secretario financiero" — Sociedad de Socorro:
// "Presidenta", "Secretaria", "Maestra de clase"). Cada barrio los crea a su
// gusto desde la pantalla de Organizaciones — no viene con un seed fijo
// porque cada unidad nombra sus llamamientos distinto. Los permisos de cada
// módulo se otorgan sobre un llamamiento específico (ver ModuloLlamamiento),
// no sobre la organización completa — así el secretario financiero del
// Obispado puede tener un acceso distinto al del Obispo, aunque ambos sean
// parte de la misma organización.
@Entity('llamamientos')
@Unique(['organizacionId', 'nombre'])
export class Llamamiento {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Organizacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacionId' })
  organizacion: Organizacion;

  @Column()
  organizacionId: number;

  @Column()
  nombre: string;

  @Column({ default: true })
  activo: boolean;
}
