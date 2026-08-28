import * as dotenv from 'dotenv';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Usuario } from '../src/usuarios/models/usuario.entity';
import { Role, ROLES_SEED } from '../src/usuarios/models/role.entity';

dotenv.config();

function randomPassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function main() {
  const [nombres, apellidos, email] = process.argv.slice(2);
  if (!nombres || !apellidos || !email) {
    console.error('Uso: npm run seed:superadmin -- <nombres> <apellidos> <email>');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Usuario, Role],
    synchronize: false,
  });
  await dataSource.initialize();

  const roleRepo = dataSource.getRepository(Role);
  const usuarioRepo = dataSource.getRepository(Usuario);

  let role = await roleRepo.findOne({ where: { nombre: 'SuperAdmin' } });
  if (!role) {
    const seed = ROLES_SEED.find((r) => r.nombre === 'SuperAdmin')!;
    role = await roleRepo.save(roleRepo.create(seed));
  }

  const existente = await usuarioRepo.findOne({ where: { email } });
  if (existente) {
    console.log(`Ya existe un usuario con email="${email}" (id=${existente.id}).`);
    console.log('Borra esa fila primero si quieres regenerar la contraseña.');
    await dataSource.destroy();
    return;
  }

  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await usuarioRepo.save(
    usuarioRepo.create({
      nombres,
      apellidos,
      email,
      passwordHash,
      roleId: role.id,
      estado: 'activo',
    }),
  );

  console.log(`SuperAdmin "${email}" creado (id=${usuario.id}).`);
  console.log('Guarda esta contraseña AHORA — no se puede recuperar después:');
  console.log(password);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
