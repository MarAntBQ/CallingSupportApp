import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Jerarquía por nivel numérico. SuperAdmin (el administrador real del
// sistema) es el único bypass incondicional de los módulos de negocio (ver
// ModuloAccessGuard) — ni siquiera Obispado pasa gratis: el acceso de cada
// persona a cada módulo se decide por su LLAMAMIENTO específico (ver
// ModuloLlamamiento), no por el rol. Obispado sigue siendo el nivel que
// administra el SISTEMA (usuarios, organizaciones, llamamientos, config —
// ver AdminGlobalGuard/NIVEL_ADMIN_TOTAL), que es un permiso distinto al de
// ver/editar datos de un módulo de negocio como Viaje al Templo.
export const ROLES_SEED = [
  { nombre: 'SuperAdmin', nivel: 100 },
  { nombre: 'Obispado', nivel: 80 },
  { nombre: 'Líder', nivel: 50 },
  { nombre: 'Miembro', nivel: 10 },
  { nombre: 'Amigo de la Iglesia', nivel: 5 },
] as const;

export const NIVEL_ADMIN_TOTAL = 80; // Obispado o superior: administra el sistema (usuarios/organizaciones/llamamientos/config)
export const NIVEL_SUPERADMIN = 100; // Único bypass incondicional de los módulos de negocio

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nombre: string;

  @Column()
  nivel: number;
}
