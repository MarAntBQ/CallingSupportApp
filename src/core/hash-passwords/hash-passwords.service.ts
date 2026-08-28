import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class HashPasswordsService {
  async hashPassword(password: string, salt = 12): Promise<string> {
    return bcrypt.hash(password, salt);
  }

  async verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
