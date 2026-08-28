import { IsEmail, IsString } from 'class-validator';

export class VerifyResetOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  otpCode: string;
}
