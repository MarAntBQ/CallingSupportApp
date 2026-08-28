import { Module } from '@nestjs/common';
import { HashPasswordsService } from './hash-passwords.service';

@Module({
  providers: [HashPasswordsService],
  exports: [HashPasswordsService],
})
export class CoreHashPasswordsModule {}
