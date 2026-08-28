import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { ORDENANZAS, GENEROS } from '../templo.constants';

export class ParticipanteDto {
  @IsString()
  @IsNotEmpty()
  cedulaOPasaporte: string;

  @IsDateString()
  fechaNacimiento: string;

  @IsString()
  @IsNotEmpty()
  nombreCompleto: string;

  @IsString()
  @IsNotEmpty()
  telefono: string;

  @IsEmail()
  email: string;

  @IsIn(GENEROS)
  genero: string;

  @IsBoolean()
  vaEnTransporte: boolean;

  @IsBoolean()
  necesitaHospedaje: boolean;

  @IsBoolean()
  quiereDesayuno: boolean;

  @IsBoolean()
  quiereAlmuerzo: boolean;

  // Opcional — un hermano puede inscribir a un hijo que aún no tiene la
  // edad para realizar ordenanzas, pero sí asiste al viaje.
  @IsArray()
  @IsIn(ORDENANZAS, { each: true })
  ordenanzas: string[];
}

export class CreateInscripcionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParticipanteDto)
  participantes: ParticipanteDto[];

  @IsOptional()
  @IsString()
  recaptchaToken?: string | null;

  // Consentimiento explícito (art. 8/26 LOPDP) — obligatorio porque se
  // recogen las ordenanzas deseadas, un dato de creencia religiosa.
  @Equals(true, { message: 'Falta el consentimiento explícito del titular' })
  consentimiento: boolean;

  @IsString()
  @IsNotEmpty()
  policyVersion: string;
}
