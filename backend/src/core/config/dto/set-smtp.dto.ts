import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class SetSmtpDto {
  @IsString()
  @MinLength(1)
  host: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsBoolean()
  secure: boolean;

  @IsString()
  @MinLength(1)
  user: string;

  // Opcional — si no viene, se conserva la contraseña ya guardada.
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;
}
