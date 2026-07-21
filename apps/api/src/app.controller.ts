import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AppService } from './app.service';
import { CoordinatorGuard } from './coordinator.guard';

@Controller('demo')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('state')
  getState() {
    return this.appService.getState();
  }

  @Post('resolve-absence')
  @UseGuards(CoordinatorGuard)
  resolveAbsence(@Headers('x-demo-user') actor = 'Maya Chen') {
    return this.appService.resolveAbsence(actor);
  }

  @Post('publish')
  @UseGuards(CoordinatorGuard)
  publish(@Headers('x-demo-user') actor = 'Maya Chen') {
    return this.appService.publish(actor);
  }

  @Post('acknowledge')
  acknowledge(@Headers('x-demo-user') actor = 'Jordan Lee') {
    return this.appService.acknowledge(actor);
  }

  @Post('reset')
  @HttpCode(200)
  @UseGuards(CoordinatorGuard)
  reset() {
    return this.appService.reset();
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'bandboard-api',
      timestamp: new Date().toISOString(),
    };
  }
}
