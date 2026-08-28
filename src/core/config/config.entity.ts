import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Fila única (siempre id=1) — mismo patrón usado en otros proyectos de Marco
// Antonio para configuración global editable desde una pantalla de admin.
@Entity('config')
export class AppConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: false })
  permitirRegistro: boolean;

  @Column({ default: '' })
  nombreUnidad: string;
}
