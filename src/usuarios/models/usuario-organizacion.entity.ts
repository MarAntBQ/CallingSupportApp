import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Usuario } from './usuario.entity';
import { Organizacion } from './organizacion.entity';

// A qué organización(es) pertenece un usuario — una persona puede estar en
// más de una a la vez (ej. Sociedad de Socorro además de Escuela Dominical).
@Entity('usuario_organizaciones')
@Unique(['usuarioId', 'organizacionId'])
export class UsuarioOrganizacion {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Column()
  usuarioId: number;

  @ManyToOne(() => Organizacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizacionId' })
  organizacion: Organizacion;

  @Column()
  organizacionId: number;
}
