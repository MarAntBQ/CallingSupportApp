import { IsBoolean } from 'class-validator';

export class AprobarParticipanteDto {
  @IsBoolean()
  aprobado: boolean;
}
