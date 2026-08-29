import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtGenerated } from '../auth/models/jwt-generated.entity';
import { Usuario } from '../usuarios/models/usuario.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SharedGuardsModule } from '../auth/shared-guards.module';

@Module({
  imports: [TypeOrmModule.forFeature([JwtGenerated, Usuario]), SharedGuardsModule],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
