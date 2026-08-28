import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from './config.entity';
import { ConfigAppService } from './config.service';
import { ConfigAppController } from './config.controller';
import { SharedGuardsModule } from '../../auth/shared-guards.module';

@Module({
  imports: [TypeOrmModule.forFeature([AppConfig]), SharedGuardsModule],
  providers: [ConfigAppService],
  controllers: [ConfigAppController],
  exports: [ConfigAppService],
})
export class ConfigAppModule {}
