import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCobradorDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;
}

export class UpdateCobradorDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}
