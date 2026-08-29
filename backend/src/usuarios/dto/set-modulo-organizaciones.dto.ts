import { IsArray, IsBoolean, IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PermisoOrganizacionDto {
  @IsInt()
  organizacionId: number;

  @IsBoolean()
  puedeLeer: boolean;

  @IsBoolean()
  puedeCrear: boolean;

  @IsBoolean()
  puedeEditar: boolean;

  @IsBoolean()
  puedeEliminar: boolean;
}

export class SetModuloOrganizacionesDto {
  @IsString()
  moduloClave: string;

  // Reemplaza el set completo de permisos del módulo — igual patrón que
  // organizacionIds en UpdateUsuarioDto, simple de manejar desde una
  // pantalla con checkboxes en vez de ir permiso por permiso.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermisoOrganizacionDto)
  permisos: PermisoOrganizacionDto[];
}
