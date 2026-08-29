import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { JwtGenerated } from './models/jwt-generated.entity';
import { JwtPayload } from './jwt-payload.interface';

// Igual patrón que ModuloAccessGuard: @InjectDataSource() en vez de
// @InjectRepository() porque este servicio termina siendo usado desde
// JwtAuthGuard, que se referencia por clase vía @UseGuards() en controladores
// de módulos distintos — @InjectRepository ata la resolución al forFeature()
// del módulo donde se declaró y falla en ese escenario cross-módulo.
@Injectable()
export class JwtSessionsService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // Persiste cada JWT emitido — replica jwt_generated de MarbustSystem, así
  // un logout o una revocación administrativa puede invalidar el token antes
  // de su expiración natural (una firma válida ya no basta por sí sola).
  async signAndPersist(payload: JwtPayload, expiresIn: '1h' | '30d' = '30d'): Promise<string> {
    const repo = this.dataSource.getRepository(JwtGenerated);
    await repo.createQueryBuilder().delete().where('expiration <= NOW()').execute();

    const token = await this.jwtService.signAsync(payload, { expiresIn });
    const decoded = this.jwtService.decode(token) as { exp: number };

    await repo.save(
      repo.create({
        payload: JSON.stringify(payload),
        token,
        active: true,
        expiration: new Date(decoded.exp * 1000),
      }),
    );

    return token;
  }

  async verifyPersisted(token: string): Promise<JwtPayload> {
    const decoded = await this.jwtService.verifyAsync<JwtPayload>(token);

    const repo = this.dataSource.getRepository(JwtGenerated);
    const saved = await repo.findOne({ where: { token, active: true } });
    if (!saved) {
      throw new Error('Token revocado o inexistente.');
    }
    if (saved.expiration <= new Date()) {
      saved.active = false;
      await repo.save(saved);
      throw new Error('Token expirado.');
    }

    return decoded;
  }

  async revoke(token: string): Promise<void> {
    const repo = this.dataSource.getRepository(JwtGenerated);
    await repo.update({ token }, { active: false });
  }
}
