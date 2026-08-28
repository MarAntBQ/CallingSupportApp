import { Module } from '@nestjs/common';
import { OtpCodeService } from './otp-code.service';

@Module({
  providers: [OtpCodeService],
  exports: [OtpCodeService],
})
export class CoreOtpCodeModule {}
