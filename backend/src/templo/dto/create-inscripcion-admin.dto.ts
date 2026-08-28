import { Type } from 'class-transformer';
import { ArrayMinSize, Equals, IsArray, IsInt, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { ParticipanteDto } from './create-inscripcion.dto';

// Inscripción creada desde el panel admin (Marco registrando a alguien
// directamente) — sin reCAPTCHA y sin la restricción de fecha límite del
// formulario público, ya que quien la crea es un usuario autenticado.
export class CreateInscripcionAdminDto {
  @IsInt()
  viajeId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParticipanteDto)
  participantes: ParticipanteDto[];

  // Marco confirma que cuenta con el consentimiento del titular (o de su
  // padre/madre/tutor si es menor) para registrar estos datos.
  @Equals(true, { message: 'Falta confirmar el consentimiento del titular' })
  consentimiento: boolean;

  @IsString()
  @IsNotEmpty()
  policyVersion: string;
}
