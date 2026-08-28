import { IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ORDENANZAS, GENEROS } from '../templo.constants';

export class UpdateParticipanteDto {
  @IsOptional() @IsString() @IsNotEmpty() cedulaOPasaporte?: string;
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsString() @IsNotEmpty() nombreCompleto?: string;
  @IsOptional() @IsString() @IsNotEmpty() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(GENEROS) genero?: string;
  @IsOptional() @IsBoolean() vaEnTransporte?: boolean;
  @IsOptional() @IsBoolean() necesitaHospedaje?: boolean;
  @IsOptional() @IsBoolean() quiereDesayuno?: boolean;
  @IsOptional() @IsBoolean() quiereAlmuerzo?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(ORDENANZAS, { each: true })
  ordenanzas?: string[];
}
