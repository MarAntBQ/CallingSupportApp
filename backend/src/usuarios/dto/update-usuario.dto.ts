import { IsIn, IsInt, IsOptional } from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsInt()
  roleId?: number;

  @IsOptional()
  @IsIn(['pendiente', 'activo', 'suspendido'])
  estado?: 'pendiente' | 'activo' | 'suspendido';

  // Reemplaza el set completo de organizaciones del usuario (simple de
  // manejar desde una pantalla con checkboxes, en vez de add/remove uno por uno).
  @IsOptional()
  organizacionIds?: number[];
}
