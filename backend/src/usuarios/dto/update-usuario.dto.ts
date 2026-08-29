import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsOptional()
  @IsIn(['pendiente', 'activo', 'suspendido'])
  estado?: 'pendiente' | 'activo' | 'suspendido';

  // Reemplaza el set completo de llamamientos del usuario (simple de
  // manejar desde un multi-select, en vez de add/remove uno por uno).
  @IsOptional()
  llamamientoIds?: number[];

  @IsOptional()
  @IsString()
  llamamiento?: string;
}
