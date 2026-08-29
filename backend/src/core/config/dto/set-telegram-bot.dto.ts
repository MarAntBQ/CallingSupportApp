import { IsString, MinLength } from 'class-validator';

export class SetTelegramBotDto {
  @IsString()
  @MinLength(20)
  botToken: string;

  @IsString()
  @MinLength(1)
  botUsername: string;
}
