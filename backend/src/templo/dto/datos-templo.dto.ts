import { IsOptional, IsString } from 'class-validator';

// Apellidos/Nombres/Nacionalidad — solo hacen falta para el Excel que se
// envía al templo (el formulario público no los pide por separado).
export class ActualizarDatosTemploDto {
  @IsOptional() @IsString() apellidos?: string;
  @IsOptional() @IsString() nombres?: string;
  @IsOptional() @IsString() nacionalidad?: string;
}
