import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Usuario } from './usuario.entity';
import { Llamamiento } from './llamamiento.entity';

// Qué llamamiento(s) porta un usuario — una persona puede tener más de uno a
// la vez (ej. Secretaria de Sociedad de Socorro + Especialista de Mujeres
// Jóvenes). Reemplaza a UsuarioOrganizacion: la organización a la que
// pertenece un usuario ahora se deriva de sus llamamientos
// (llamamiento.organizacionId), no se guarda por separado.
@Entity('usuario_llamamientos')
@Unique(['usuarioId', 'llamamientoId'])
export class UsuarioLlamamiento {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Column()
  usuarioId: number;

  @ManyToOne(() => Llamamiento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'llamamientoId' })
  llamamiento: Llamamiento;

  @Column()
  llamamientoId: number;
}
