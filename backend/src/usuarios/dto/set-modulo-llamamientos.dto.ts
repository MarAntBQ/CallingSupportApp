import { IsArray, IsBoolean, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PermisoLlamamientoDto {
  @IsInt()
  llamamientoId: number;

  @IsBoolean()
  puedeLeer: boolean;

  @IsBoolean()
  puedeCrear: boolean;

  @IsBoolean()
  puedeEditar: boolean;

  @IsBoolean()
  puedeEliminar: boolean;
}

export class SetModuloLlamamientosDto {
  @IsString()
  moduloClave: string;

  // Reemplaza el set completo de permisos del módulo — simple de manejar
  // desde una matriz de checkboxes en vez de ir permiso por permiso.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermisoLlamamientoDto)
  permisos: PermisoLlamamientoDto[];
}
