import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TemploInscripcion } from './templo-inscripcion.entity';
import { TemploAbono } from './templo-abono.entity';
import { TemploHabitacion } from './templo-habitacion.entity';

@Entity('templo_participantes')
export class TemploParticipante {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TemploInscripcion, (i) => i.participantes)
  inscripcion: TemploInscripcion;

  @Column()
  cedulaOPasaporte: string;

  @Column({ type: 'date' })
  fechaNacimiento: string;

  @Column()
  nombreCompleto: string;

  @Column()
  telefono: string;

  @Column()
  email: string;

  @Column({ type: 'varchar' })
  genero: string;

  @Column({ default: false })
  vaEnTransporte: boolean;

  @Column({ default: false })
  necesitaHospedaje: boolean;

  // Desayuno/almuerzo son opcionales por persona (no automáticos aunque el
  // viaje los incluya) — alguien puede no querer, o llevar el suyo.
  @Column({ default: false })
  quiereDesayuno: boolean;

  @Column({ default: false })
  quiereAlmuerzo: boolean;

  // Guardado como texto separado por comas (ej. "Baptisterio, Investidura"),
  // mismo patrón que `asignados` en el módulo techywe — no amerita una tabla
  // aparte para 4 valores fijos.
  @Column({ type: 'text' })
  ordenanzas: string;

  // Un cupo (ordenanza+género o transporte) solo se contabiliza como ocupado
  // cuando Marco Antonio aprueba — así nadie queda bloqueado por solicitudes
  // que todavía no se revisan.
  @Column({ default: false })
  aprobado: boolean;

  // Costo fijado al momento de la inscripción (no cambia si luego se editan
  // los precios del viaje) — desayuno/almuerzo si el viaje los incluye,
  // transporte solo si vaEnTransporte.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costoTotal: string;

  // Seguimiento en vivo el día del viaje — se marcan con un clic desde la
  // lista imprimible/en pantalla, no requieren revalidar cupos ni pasar por
  // actualizarParticipante (ver PATCH /templo/participantes/:id/logistica).
  @Column({ default: false })
  subioIda: boolean;

  @Column({ default: false })
  subioRegreso: boolean;

  @Column({ default: false })
  desayunoEntregado: boolean;

  @Column({ default: false })
  almuerzoEntregado: boolean;

  @OneToMany(() => TemploAbono, (a) => a.participante)
  abonos: TemploAbono[];

  // Solo aplica si necesitaHospedaje — a qué habitación del templo (6
  // personas) queda asignado y con qué rol dentro de ella.
  @ManyToOne(() => TemploHabitacion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  habitacion: TemploHabitacion | null;

  // 'lider' | 'huesped'
  @Column({ type: 'varchar', nullable: true })
  rolHabitacion: string | null;

  // Solo se llenan cuando hace falta generar el Excel de habitaciones para
  // el templo (que exige Apellidos/Nombres separados) — el formulario
  // público solo pide nombreCompleto, así que quedan null hasta que Marco
  // los revisa/corrige en esa pantalla. Una vez guardados, no hay que
  // volver a adivinarlos en la próxima exportación.
  @Column({ type: 'varchar', nullable: true })
  apellidos: string | null;

  @Column({ type: 'varchar', nullable: true })
  nombres: string | null;

  @Column({ type: 'varchar', nullable: true })
  nacionalidad: string | null;
}
