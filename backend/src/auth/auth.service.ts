import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtSessionsService } from './jwt-sessions.service';
import { Usuario } from '../usuarios/models/usuario.entity';
import { Role, NIVEL_ADMIN_TOTAL } from '../usuarios/models/role.entity';
import { UsuarioOrganizacion } from '../usuarios/models/usuario-organizacion.entity';
import { ModuloOrganizacion } from '../usuarios/models/modulo-organizacion.entity';
import { HashPasswordsService } from '../core/hash-passwords/hash-passwords.service';
import { OtpCodeService } from '../core/otp-code/otp-code.service';
import { MailService } from '../core/mail/mail.service';
import { ConfigAppService } from '../core/config/config.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './jwt-payload.interface';

const MAX_OTP_TRIES = 3;
// Rol por defecto para quien se auto-registra — un Obispado/SuperAdmin
// promueve manualmente a Líder después si corresponde.
const ROL_POR_DEFECTO = 'Miembro';

// Módulos que existen en el sistema — son código, no datos (ver comentario
// en ModuloOrganizacion), así que la lista vive acá y no en una tabla.
// El frontend usa modulosPermitidos (calculado en me()) para decidir qué
// ítems de administración mostrar en la navegación.
const MODULOS_DISPONIBLES = ['viaje_templo'];

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UsuarioOrganizacion)
    private readonly usuarioOrgRepo: Repository<UsuarioOrganizacion>,
    @InjectRepository(ModuloOrganizacion)
    private readonly moduloOrgRepo: Repository<ModuloOrganizacion>,
    private readonly hashPasswordsService: HashPasswordsService,
    private readonly otpCodeService: OtpCodeService,
    private readonly mailService: MailService,
    private readonly configAppService: ConfigAppService,
    private readonly jwtSessionsService: JwtSessionsService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const cfg = await this.configAppService.load();
    if (!cfg.permitirRegistro) {
      throw new ForbiddenException('El registro de nuevos usuarios está deshabilitado en este momento.');
    }

    const existente = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    if (existente) {
      throw new BadRequestException('Ya existe una cuenta con ese correo.');
    }

    const rol = await this.roleRepo.findOne({ where: { nombre: ROL_POR_DEFECTO } });
    if (!rol) throw new BadRequestException('Rol por defecto no configurado — contacta al administrador.');

    const otpCode = this.otpCodeService.generateOtpCode();
    const passwordHash = await this.hashPasswordsService.hashPassword(dto.password);

    await this.usuarioRepo.save(
      this.usuarioRepo.create({
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        email: dto.email,
        telefono: dto.telefono ?? null,
        passwordHash,
        roleId: rol.id,
        estado: 'pendiente',
        otpCode,
        otpTries: 0,
      }),
    );

    await this.mailService.send('auth-register', {
      to: dto.email,
      subject: `Verifica tu cuenta — código ${otpCode}`,
      message: `Bienvenido. Tu código de verificación es: ${otpCode}`,
      html: `<h2>Verifica tu cuenta</h2><p>Tu código de verificación es: <strong>${otpCode}</strong></p>`,
    });

    return { message: 'Cuenta creada. Revisa tu correo para verificarla.' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string }> {
    const usuario = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (usuario.estado === 'activo') throw new BadRequestException('Esta cuenta ya está activada.');

    if (!usuario.otpCode || usuario.otpTries >= MAX_OTP_TRIES) {
      const nuevoCodigo = this.otpCodeService.generateOtpCode();
      usuario.otpCode = nuevoCodigo;
      usuario.otpTries = 0;
      await this.usuarioRepo.save(usuario);
      await this.mailService.send('auth-verify-otp', {
        to: usuario.email,
        subject: `Nuevo código de verificación — ${nuevoCodigo}`,
        message: `Tu nuevo código de verificación es: ${nuevoCodigo}`,
      });
      throw new BadRequestException('El código anterior venció. Te enviamos uno nuevo por correo.');
    }

    if (usuario.otpCode !== dto.otpCode) {
      usuario.otpTries += 1;
      await this.usuarioRepo.save(usuario);
      throw new BadRequestException(
        `Código incorrecto. Te quedan ${MAX_OTP_TRIES - usuario.otpTries} intento(s).`,
      );
    }

    usuario.estado = 'activo';
    usuario.otpCode = null;
    usuario.otpTries = 0;
    await this.usuarioRepo.save(usuario);

    return { message: 'Cuenta activada correctamente.' };
  }

  private async signFor(usuario: Usuario, rememberMe: boolean): Promise<string> {
    const role = usuario.role ?? (await this.roleRepo.findOne({ where: { id: usuario.roleId } }));
    const organizaciones = await this.usuarioOrgRepo.find({ where: { usuarioId: usuario.id } });
    const payload: JwtPayload = {
      userId: usuario.id,
      roleId: usuario.roleId,
      nivel: role?.nivel ?? 0,
      orgIds: organizaciones.map((o) => o.organizacionId),
    };
    return this.jwtSessionsService.signAndPersist(payload, rememberMe ? '30d' : '1h');
  }

  async logout(token: string): Promise<{ message: string }> {
    await this.jwtSessionsService.revoke(token);
    return { message: 'Sesión cerrada correctamente.' };
  }

  async login(dto: LoginDto): Promise<{ token: string; usuario: Record<string, unknown> }> {
    const usuario = await this.usuarioRepo.findOne({ where: { email: dto.email }, relations: ['role'] });
    if (!usuario) throw new UnauthorizedException('Correo o contraseña incorrectos.');

    const passwordValida = await this.hashPasswordsService.verifyPassword(usuario.passwordHash, dto.password);
    if (!passwordValida) throw new UnauthorizedException('Correo o contraseña incorrectos.');

    if (usuario.estado === 'pendiente') {
      throw new ForbiddenException('Verifica tu cuenta con el código enviado a tu correo antes de iniciar sesión.');
    }
    if (usuario.estado === 'suspendido') {
      throw new ForbiddenException('Tu cuenta está suspendida. Contacta al Obispado.');
    }

    const token = await this.signFor(usuario, dto.rememberMe ?? false);
    const organizaciones = await this.usuarioOrgRepo.find({ where: { usuarioId: usuario.id } });
    const modulosPermitidos = await this.calcularModulosPermitidos(
      usuario.role.nivel,
      organizaciones.map((o) => o.organizacionId),
    );
    return {
      token,
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        email: usuario.email,
        role: usuario.role.nombre,
        modulosPermitidos,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const usuario = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    // No revelar si el correo existe o no — siempre el mismo mensaje.
    if (usuario && usuario.estado === 'activo') {
      const resetOtpCode = this.otpCodeService.generateOtpCode();
      usuario.resetOtpCode = resetOtpCode;
      usuario.resetOtpTries = 0;
      usuario.resetOtpVerified = false;
      await this.usuarioRepo.save(usuario);

      await this.mailService.send('auth-forgot-password', {
        to: usuario.email,
        subject: `Restablecer contraseña — código ${resetOtpCode}`,
        message: `Solicitaste restablecer tu contraseña. Tu código es: ${resetOtpCode}. Si no fuiste tú, ignora este correo.`,
      });
    }
    return { message: 'Si el correo existe, te enviamos un código de verificación.' };
  }

  async verifyResetOtp(dto: VerifyResetOtpDto): Promise<{ message: string }> {
    const usuario = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    if (!usuario || !usuario.resetOtpCode) {
      throw new BadRequestException('No hay una solicitud de restablecimiento pendiente para este correo.');
    }
    if (usuario.resetOtpTries >= MAX_OTP_TRIES) {
      usuario.resetOtpCode = null;
      usuario.resetOtpTries = 0;
      await this.usuarioRepo.save(usuario);
      throw new BadRequestException('Demasiados intentos. Solicita un nuevo código.');
    }
    if (usuario.resetOtpCode !== dto.otpCode) {
      usuario.resetOtpTries += 1;
      await this.usuarioRepo.save(usuario);
      throw new BadRequestException(`Código incorrecto. Te quedan ${MAX_OTP_TRIES - usuario.resetOtpTries} intento(s).`);
    }
    usuario.resetOtpVerified = true;
    usuario.resetOtpCode = null;
    usuario.resetOtpTries = 0;
    await this.usuarioRepo.save(usuario);
    return { message: 'Código verificado. Ya puedes definir tu nueva contraseña.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const usuario = await this.usuarioRepo.findOne({ where: { email: dto.email } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (!usuario.resetOtpVerified) {
      throw new BadRequestException('Primero verifica el código de restablecimiento.');
    }
    usuario.passwordHash = await this.hashPasswordsService.hashPassword(dto.newPassword);
    usuario.resetOtpVerified = false;
    await this.usuarioRepo.save(usuario);

    await this.mailService.send('auth-reset-password', {
      to: usuario.email,
      subject: 'Tu contraseña fue restablecida',
      message: 'Tu contraseña fue restablecida exitosamente. Si no fuiste tú, contacta al Obispado.',
    });
    return { message: 'Contraseña restablecida correctamente.' };
  }

  async me(userId: number): Promise<Record<string, unknown>> {
    const usuario = await this.usuarioRepo.findOne({ where: { id: userId }, relations: ['role'] });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    const organizaciones = await this.usuarioOrgRepo.find({ where: { usuarioId: usuario.id }, relations: ['organizacion'] });
    const modulosPermitidos = await this.calcularModulosPermitidos(
      usuario.role.nivel,
      organizaciones.map((o) => o.organizacionId),
    );
    return {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      email: usuario.email,
      role: usuario.role.nombre,
      organizaciones: organizaciones.map((o) => o.organizacion.nombre),
      modulosPermitidos,
    };
  }

  // Mismo criterio que ModuloAccessGuard: Obispado/SuperAdmin ven todos los
  // módulos que existen; un Líder solo los que administra alguna de sus
  // organizaciones; el resto de roles, ninguno.
  private async calcularModulosPermitidos(nivel: number, orgIds: number[]): Promise<string[]> {
    if (nivel >= NIVEL_ADMIN_TOTAL) return [...MODULOS_DISPONIBLES];
    if (orgIds.length === 0) return [];
    const habilitados = await this.moduloOrgRepo.find({ where: { organizacionId: In(orgIds) } });
    return [...new Set(habilitados.map((h) => h.moduloClave))];
  }
}
