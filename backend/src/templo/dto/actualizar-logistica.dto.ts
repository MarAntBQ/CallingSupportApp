import { IsBoolean, IsOptional } from 'class-validator';

// Estado logístico del día del viaje (subir al bus, entrega de comida) —
// deliberadamente separado de UpdateParticipanteDto: no debe disparar
// revalidación de cupos, solo un guardado directo al hacer clic.
export class ActualizarLogisticaDto {
  @IsOptional() @IsBoolean() subioIda?: boolean;
  @IsOptional() @IsBoolean() subioRegreso?: boolean;
  @IsOptional() @IsBoolean() desayunoEntregado?: boolean;
  @IsOptional() @IsBoolean() almuerzoEntregado?: boolean;
}
