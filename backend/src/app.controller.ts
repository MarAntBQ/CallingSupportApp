import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  welcome() {
    return { message: `${process.env.APP_NAME ?? 'CallingSupportApp'} API` };
  }
}
