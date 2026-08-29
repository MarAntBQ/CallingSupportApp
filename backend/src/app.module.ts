import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { ConfigAppModule } from './core/config/config.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { SharedGuardsModule } from './auth/shared-guards.module';
import { TemploModule } from './templo/templo.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      charset: 'utf8mb4',
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      retryAttempts: 5,
      retryDelay: 3000,
    }),
    ConfigAppModule,
    AuthModule,
    UsuariosModule,
    SharedGuardsModule,
    TemploModule,
    SessionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
