import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateViajeDto {
  @IsDateString()
  fecha: string;

  @IsDateString()
  fechaLimiteInscripcion: string;

  @IsOptional() @IsBoolean() fechaConfirmada?: boolean;

  @IsOptional() @IsBoolean() incluyeTransporte?: boolean;
  @IsOptional() @IsBoolean() incluyeHospedaje?: boolean;
  @IsOptional() @IsBoolean() incluyeDesayuno?: boolean;
  @IsOptional() @IsBoolean() incluyeAlmuerzo?: boolean;

  @IsOptional() @IsNumber() @Min(0) costoTransporte?: number;
  @IsOptional() @IsNumber() @Min(0) costoDesayuno?: number;
  @IsOptional() @IsNumber() @Min(0) costoAlmuerzo?: number;

  @IsOptional() @IsInt() @Min(0) cuposTransporte?: number;
  @IsOptional() @IsInt() @Min(0) cuposHospedaje?: number;
  @IsOptional() @IsInt() @Min(0) cuposBaptisterioHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposBaptisterioMujeres?: number;
  @IsOptional() @IsInt() @Min(0) cuposIniciatoriasHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposIniciatoriasMujeres?: number;
  @IsOptional() @IsInt() @Min(0) cuposInvestiduraHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposInvestiduraMujeres?: number;
  @IsOptional() @IsInt() @Min(0) cuposSellamientoHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposSellamientoMujeres?: number;

  @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateViajeDto {
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsDateString() fechaLimiteInscripcion?: string;

  @IsOptional() @IsBoolean() fechaConfirmada?: boolean;

  @IsOptional() @IsBoolean() incluyeTransporte?: boolean;
  @IsOptional() @IsBoolean() incluyeHospedaje?: boolean;
  @IsOptional() @IsBoolean() incluyeDesayuno?: boolean;
  @IsOptional() @IsBoolean() incluyeAlmuerzo?: boolean;

  @IsOptional() @IsNumber() @Min(0) costoTransporte?: number;
  @IsOptional() @IsNumber() @Min(0) costoDesayuno?: number;
  @IsOptional() @IsNumber() @Min(0) costoAlmuerzo?: number;

  @IsOptional() @IsInt() @Min(0) cuposTransporte?: number;
  @IsOptional() @IsInt() @Min(0) cuposHospedaje?: number;
  @IsOptional() @IsInt() @Min(0) cuposBaptisterioHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposBaptisterioMujeres?: number;
  @IsOptional() @IsInt() @Min(0) cuposIniciatoriasHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposIniciatoriasMujeres?: number;
  @IsOptional() @IsInt() @Min(0) cuposInvestiduraHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposInvestiduraMujeres?: number;
  @IsOptional() @IsInt() @Min(0) cuposSellamientoHombres?: number;
  @IsOptional() @IsInt() @Min(0) cuposSellamientoMujeres?: number;

  @IsOptional() @IsBoolean() activo?: boolean;
}
