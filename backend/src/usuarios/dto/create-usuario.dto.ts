import { IsArray, IsEmail, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

// Creación directa por un admin (SuperAdmin/Obispado) — a diferencia de
// /auth/register, no pasa por OTP: el admin ya está dando de alta a alguien
// de confianza. Se genera una contraseña temporal y se le envía por correo.
export class CreateUsuarioDto {
  @IsString()
  @MinLength(2)
  nombres: string;

  @IsString()
  @MinLength(2)
  apellidos: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsInt()
  roleId: number;

  @IsOptional()
  @IsArray()
  llamamientoIds?: number[];

  @IsOptional()
  @IsString()
  llamamiento?: string;
}
