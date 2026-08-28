import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Organizacion } from './organizacion.entity';

// Qué organizaciones pueden ADMINISTRAR cada módulo (ej. "viaje_templo" lo
// administran Quorum y Sociedad de Socorro, pero no Primaria). Editable desde
// una pantalla de configuración por el Obispado/SuperAdmin — moduloClave es
// un string libre que cada módulo declara (no hay una tabla de "módulos"
// separada porque los módulos son código, no datos).
@Entity('modulo_organizaciones')
@Unique(['moduloClave', 'organizacionId'])
export class ModuloOrganizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  moduloClave: string;

  @ManyToOne(() => Organizacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacionId' })
  organizacion: Organizacion;

  @Column()
  organizacionId: number;
}
