import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ConfigAppService } from './config.service';
import { RequiereAdminGlobal } from '../../auth/decorators/requiere-admin-global.decorator';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SetTelegramBotDto } from './dto/set-telegram-bot.dto';
import { SetSmtpDto } from './dto/set-smtp.dto';
import { SetLogoDto } from './dto/set-logo.dto';
import { TestSmtpDto } from './dto/test-smtp.dto';

@Controller('config')
export class ConfigAppController {
  constructor(private readonly configAppService: ConfigAppService) {}

  // Público — el frontend lo usa para saber si mostrar el link de "Registrarse",
  // qué nombre de unidad mostrar y el logo, antes de que haya login.
  @Get()
  async get() {
    const cfg = await this.configAppService.load();
    return { permitirRegistro: cfg.permitirRegistro, nombreUnidad: cfg.nombreUnidad, logoDataUrl: cfg.logoDataUrl };
  }

  @Patch()
  @RequiereAdminGlobal()
  async update(@Body() dto: UpdateConfigDto) {
    return this.configAppService.update(dto);
  }

  @Post('logo')
  @RequiereAdminGlobal()
  async setLogo(@Body() dto: SetLogoDto) {
    await this.configAppService.setLogo(dto.logoDataUrl ?? null);
    return { message: 'Logo actualizado.' };
  }

  // El token se cifra al vuelo (ver ConfigAppService.setTelegramBot) — no
  // se puede leer de vuelta, solo reemplazar. El bot lo toma solo, sin
  // reiniciar el proceso (relee la config en cada vuelta del polling).
  @Post('telegram-bot')
  @RequiereAdminGlobal()
  async setTelegramBot(@Body() dto: SetTelegramBotDto) {
    await this.configAppService.setTelegramBot(dto.botToken, dto.botUsername);
    return { message: 'Bot de Telegram configurado.' };
  }

  @Get('telegram-bot')
  @RequiereAdminGlobal()
  async getTelegramBot() {
    return this.configAppService.getTelegramBotSummary();
  }

  // La contraseña SMTP tampoco se puede leer de vuelta — solo se informa
  // si ya hay una guardada (hasPassword), igual criterio que el bot.
  @Get('smtp')
  @RequiereAdminGlobal()
  async getSmtp() {
    return this.configAppService.getSmtpSummary();
  }

  @Post('smtp')
  @RequiereAdminGlobal()
  async setSmtp(@Body() dto: SetSmtpDto) {
    await this.configAppService.setSmtp(dto);
    return { message: 'Servidor de correo configurado.' };
  }

  @Post('smtp/test')
  @RequiereAdminGlobal()
  async testSmtp(@Body() dto: TestSmtpDto) {
    await this.configAppService.sendTestEmail(dto.to);
    return { message: `Correo de prueba enviado a ${dto.to}.` };
  }

  @Post('telegram-bot/test')
  @RequiereAdminGlobal()
  async testTelegramBot() {
    return this.configAppService.testTelegramBot();
  }
}
