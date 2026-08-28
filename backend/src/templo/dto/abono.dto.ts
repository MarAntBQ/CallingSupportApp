import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export const TIPOS_ABONO = ['donativo_iglesia', 'pagado_persona'] as const;

export class CreateAbonoDto {
  @IsDateString()
  fecha: string;

  @IsNumber()
  @Min(0.01)
  valor: number;

  @IsIn(TIPOS_ABONO)
  tipo: string;

  // Requerido cuando tipo = 'pagado_persona' — se valida en el service.
  @IsOptional()
  @IsInt()
  cobradorId?: number;
}

export class UpdateAbonoDto {
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsNumber() @Min(0.01) valor?: number;
  @IsOptional() @IsIn(TIPOS_ABONO) tipo?: string;
  @IsOptional() @IsInt() cobradorId?: number;
}
