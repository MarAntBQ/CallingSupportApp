import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TemploInscripcion } from './templo-inscripcion.entity';
import { TemploParticipante } from './templo-participante.entity';
import { TemploViaje } from './templo-viaje.entity';
import { TemploCobrador } from './templo-cobrador.entity';
import { TemploAbono } from './templo-abono.entity';
import { TemploHabitacion } from './templo-habitacion.entity';
import { TemploService } from './templo.service';
import { TemploMailService } from './templo-mail.service';
import { TemploController } from './templo.controller';
import { CoreMailModule } from '../core/mail/mail.module';
import { ConfigAppModule } from '../core/config/config.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TemploInscripcion,
      TemploParticipante,
      TemploViaje,
      TemploCobrador,
      TemploAbono,
      TemploHabitacion,
    ]),
    CoreMailModule,
    ConfigAppModule,
    UsuariosModule,
  ],
  providers: [TemploService, TemploMailService],
  controllers: [TemploController],
})
export class TemploModule {}
