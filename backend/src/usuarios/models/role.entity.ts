import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Jerarquía por nivel numérico. "Obispado" NO es un rol — es una
// organización más (ver Organizacion/Llamamiento): el Obispo y sus
// consejeros son rol Líder con llamamientos dentro de la organización
// "Obispado", igual que cualquier otra presidencia. Su acceso a cada
// módulo de negocio (Viaje al Templo, administrar usuarios, etc.) se
// decide por esos llamamientos específicos en la matriz de permisos (ver
// ModuloLlamamiento), no por un rol especial.
//
// SuperAdmin es el único bypass incondicional de los módulos de negocio
// (ver ModuloAccessGuard/NIVEL_SUPERADMIN). NIVEL_ADMIN_TOTAL protege por
// separado la administración del SISTEMA en sí (correos enviados,
// sesiones activas, dashboard, configuración de SMTP/Telegram) — al no
// haber ningún rol con nivel 80, esas pantallas quedan exclusivas de
// SuperAdmin (decisión explícita: son cosas del administrador técnico del
// despliegue, no de la administración del barrio).
export const ROLES_SEED = [
  { nombre: 'SuperAdmin', nivel: 100 },
  { nombre: 'Líder', nivel: 50 },
  { nombre: 'Miembro', nivel: 10 },
  { nombre: 'Amigo de la Iglesia', nivel: 5 },
] as const;

export const NIVEL_ADMIN_TOTAL = 80; // Administración del sistema (correos/sesiones/dashboard/config) — hoy solo SuperAdmin lo alcanza
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
