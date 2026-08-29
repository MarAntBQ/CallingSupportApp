import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ConfigAppService } from './config.service';
import { RequiereAdminGlobal } from '../../auth/decorators/requiere-admin-global.decorator';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SetTelegramBotDto } from './dto/set-telegram-bot.dto';

@Controller('config')
export class ConfigAppController {
  constructor(private readonly configAppService: ConfigAppService) {}

  // Público — el frontend lo usa para saber si mostrar el link de "Registrarse"
  // y qué nombre de unidad mostrar en el encabezado, antes de que haya login.
  @Get()
  async get() {
    const cfg = await this.configAppService.load();
    return { permitirRegistro: cfg.permitirRegistro, nombreUnidad: cfg.nombreUnidad };
  }

  @Patch()
  @RequiereAdminGlobal()
  async update(@Body() dto: UpdateConfigDto) {
    return this.configAppService.update(dto);
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
}
