import { IsArray, IsInt, IsString } from 'class-validator';

export class SetModuloOrganizacionesDto {
  @IsString()
  moduloClave: string;

  @IsArray()
  @IsInt({ each: true })
  organizacionIds: number[];
}
