import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateHabitacionDto {
  @IsString()
  @IsNotEmpty()
  numero: string;
}

export const ROLES_HABITACION = ['lider', 'huesped'] as const;

export class AsignarHabitacionDto {
  // null = quitar de la habitación (deja al participante sin asignar).
  @IsOptional()
  @IsInt()
  habitacionId?: number | null;

  @IsOptional()
  @IsIn(ROLES_HABITACION)
  rolHabitacion?: string | null;
}
