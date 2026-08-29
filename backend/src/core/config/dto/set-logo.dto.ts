import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SetLogoDto {
  // null para quitar el logo y volver al que trae el código por defecto.
  @IsOptional()
  @IsString()
  @MaxLength(3_000_000)
  @Matches(/^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/)
  logoDataUrl?: string | null;
}
