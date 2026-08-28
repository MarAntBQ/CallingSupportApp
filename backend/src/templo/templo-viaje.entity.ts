import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('templo_viajes')
export class TemploViaje {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  fecha: string;

  // A partir de esta fecha (inclusive) el formulario público deja de
  // aceptar inscripciones para este viaje, aunque siga activo.
  @Column({ type: 'date' })
  fechaLimiteInscripcion: string;

  // Cuando no hay fecha real todavía (se está "congelando" el viaje, solo
  // midiendo interés), `fecha` guarda una estimación de referencia — sigue
  // usándose para cupos y edad mínima de ordenanzas — pero el público ve
  // "por confirmar" en vez de la fecha exacta.
  @Column({ default: true })
  fechaConfirmada: boolean;

  // La plataforma debe soportar viajes sin transporte del barrio (cada
  // hermano ve cómo llega, solo se coordinan ordenanzas) — por eso es un
  // flag propio, igual que hospedaje/desayuno/almuerzo.
  @Column({ default: false })
  incluyeTransporte: boolean;

  @Column({ default: false })
  incluyeHospedaje: boolean;

  @Column({ default: false })
  incluyeDesayuno: boolean;

  @Column({ default: false })
  incluyeAlmuerzo: boolean;

  @Column({ default: 0 })
  cuposTransporte: number;

  // Independiente del transporte — un hermano puede ir en su propio carro
  // y aun así necesitar hospedaje para dormir en el templo.
  @Column({ default: 0 })
  cuposHospedaje: number;

  // Costo por persona de cada servicio — desayuno/almuerzo se cobran a
  // todos si el viaje los incluye; transporte solo a quien lo usa.
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costoTransporte: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costoDesayuno: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  costoAlmuerzo: string;

  @Column({ default: 0 })
  cuposBaptisterioHombres: number;

  @Column({ default: 0 })
  cuposBaptisterioMujeres: number;

  @Column({ default: 0 })
  cuposIniciatoriasHombres: number;

  @Column({ default: 0 })
  cuposIniciatoriasMujeres: number;

  @Column({ default: 0 })
  cuposInvestiduraHombres: number;

  @Column({ default: 0 })
  cuposInvestiduraMujeres: number;

  @Column({ default: 0 })
  cuposSellamientoHombres: number;

  @Column({ default: 0 })
  cuposSellamientoMujeres: number;

  // Solo un viaje puede estar activo a la vez — es al que apunta el
  // formulario público. Se activa/desactiva desde /templo/viajes/:id.
  @Column({ default: false })
  activo: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
