import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
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

  @IsString()
  @MinLength(8)
  password: string;
}
