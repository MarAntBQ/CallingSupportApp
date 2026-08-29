import { IsInt, IsString, MinLength } from 'class-validator';

export class CreateLlamamientoDto {
  @IsInt()
  organizacionId: number;

  @IsString()
  @MinLength(2)
  nombre: string;
}
