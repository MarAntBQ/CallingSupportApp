import { IsString, MinLength } from 'class-validator';

export class CreateOrganizacionDto {
  @IsString()
  @MinLength(2)
  nombre: string;
}
