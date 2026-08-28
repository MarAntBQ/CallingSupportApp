import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsBoolean()
  permitirRegistro?: boolean;

  @IsOptional()
  @IsString()
  nombreUnidad?: string;
}
