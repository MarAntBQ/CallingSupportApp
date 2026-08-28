import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Jerarquía por nivel numérico: SuperAdmin y Obispado pasan cualquier chequeo
// de módulo sin mirar organización; Líder necesita además pertenecer a una
// organización habilitada para ese módulo (ver ModuloOrganizacion); Miembro
// y Amigo de la Iglesia no tienen acceso administrativo.
export const ROLES_SEED = [
  { nombre: 'SuperAdmin', nivel: 100 },
  { nombre: 'Obispado', nivel: 80 },
  { nombre: 'Líder', nivel: 50 },
  { nombre: 'Miembro', nivel: 10 },
  { nombre: 'Amigo de la Iglesia', nivel: 5 },
] as const;

export const NIVEL_ADMIN_TOTAL = 80; // Obispado o superior: acceso a todo módulo

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column()
  nivel: number;
}
