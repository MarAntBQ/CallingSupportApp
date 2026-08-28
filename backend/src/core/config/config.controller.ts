import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ConfigAppService } from './config.service';
import { RequiereAdminGlobal } from '../../auth/decorators/requiere-admin-global.decorator';
import { UpdateConfigDto } from './dto/update-config.dto';

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
}
