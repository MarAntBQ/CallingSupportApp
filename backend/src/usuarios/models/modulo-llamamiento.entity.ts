import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Llamamiento } from './llamamiento.entity';

// Qué puede hacer cada LLAMAMIENTO específico en cada módulo — reemplaza a
// ModuloOrganizacion: el permiso ya no se otorga a toda la organización, se
// otorga a un cargo puntual (ej. el Obispo tiene CRUD completo en
// "viaje_templo", pero el Secretario Financiero del mismo Obispado no tiene
// ninguno, salvo que se le otorgue explícitamente). moduloClave es un string
// libre que cada módulo declara en su código (no hay tabla de "módulos").
@Entity('modulo_llamamientos')
@Unique(['moduloClave', 'llamamientoId'])
export class ModuloLlamamiento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  moduloClave: string;

  @ManyToOne(() => Llamamiento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'llamamientoId' })
  llamamiento: Llamamiento;

  @Column()
  llamamientoId: number;

  @Column({ default: false })
  puedeLeer: boolean;

  @Column({ default: false })
  puedeCrear: boolean;

  @Column({ default: false })
  puedeEditar: boolean;

  @Column({ default: false })
  puedeEliminar: boolean;

  // No es un permiso de acceso a una ruta — es un aviso: si está en true,
  // a esta persona se le notifica (ej. por correo) cuando ocurre un evento
  // relevante del módulo (ej. alguien se inscribe al Viaje al Templo). Cada
  // módulo decide qué eventos disparan el aviso; el guard de rutas
  // (ModuloAccessGuard) lo ignora por completo.
  @Column({ default: false })
  puedeNotificar: boolean;
}
