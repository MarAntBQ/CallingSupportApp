import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtGenerated } from '../auth/models/jwt-generated.entity';
import { Usuario } from '../usuarios/models/usuario.entity';
import { JwtPayload } from '../auth/jwt-payload.interface';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(JwtGenerated)
    private readonly jwtRepo: Repository<JwtGenerated>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  private parsePayload(raw: string): Partial<JwtPayload> {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async listActive() {
    const ahora = new Date();
    const filas = await this.jwtRepo.find({ where: { active: true }, order: { id: 'DESC' } });
    const vivas = filas.filter((f) => f.expiration > ahora);

    const userIds = [...new Set(vivas.map((f) => this.parsePayload(f.payload).userId).filter((id): id is number => !!id))];
    const usuarios = userIds.length ? await this.usuarioRepo.find({ where: userIds.map((id) => ({ id })) }) : [];
    const porId = new Map(usuarios.map((u) => [u.id, u]));

    return vivas.map((f) => {
      const userId = this.parsePayload(f.payload).userId;
      const u = userId ? porId.get(userId) : undefined;
      return {
        id: f.id,
        userId: userId ?? null,
        nombre: u ? `${u.nombres} ${u.apellidos}`.trim() : null,
        email: u?.email ?? null,
        expiration: f.expiration,
      };
    });
  }

  async revoke(id: number): Promise<{ id: number; revocado: true }> {
    const fila = await this.jwtRepo.findOne({ where: { id } });
    if (!fila) throw new NotFoundException('Sesión no encontrada.');
    fila.active = false;
    await this.jwtRepo.save(fila);
    return { id, revocado: true };
  }

  async revokeAllExcept(currentToken?: string): Promise<{ revocadas: number }> {
    const activas = await this.jwtRepo.find({ where: { active: true } });
    const ids = activas.filter((f) => f.token !== currentToken).map((f) => f.id);
    if (ids.length === 0) return { revocadas: 0 };
    await this.jwtRepo.createQueryBuilder().update().set({ active: false }).whereInIds(ids).execute();
    return { revocadas: ids.length };
  }
}
