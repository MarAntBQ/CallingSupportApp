import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Catálogo editable por el Obispado/SuperAdmin — el seed inicial cubre las
// organizaciones típicas de un barrio, pero cada despliegue puede agregar,
// renombrar o desactivar según su propia unidad (ej. separar Quorum de
// Élderes y de Diáconos en vez de uno solo).
export const ORGANIZACIONES_SEED = [
  'Obispado',
  'Quorum',
  'Sociedad de Socorro',
  'Primaria',
  'Mujeres Jóvenes',
  'Hombres Jóvenes',
  'Escuela Dominical',
];

@Entity('organizaciones')
export class Organizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column({ default: true })
  activo: boolean;
}
