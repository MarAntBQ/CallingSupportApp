import { IsEmail, IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  otpCode: string;
}
