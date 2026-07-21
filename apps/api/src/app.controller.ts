import {
  Controller,
  Body,
  Get,
  Headers,
  HttpCode,
  Post,
  Patch,
  Put,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { CoordinatorGuard } from './coordinator.guard';
import { AssignSubstituteDto } from './dto/assign-substitute.dto';
import { ReorderRepertoireDto } from './dto/reorder-repertoire.dto';
import { ReportDamageDto } from './dto/report-damage.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { WeatherService } from './weather.service';

@ApiTags('demo')
@Controller('demo')
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly weatherService: WeatherService,
  ) {}

  @Get('state')
  getState() {
    return this.appService.getState();
  }

  @Get('weather')
  getWeather() {
    return this.weatherService.getWeather();
  }

  @Get('packet')
  getPacketDownload() {
    return this.appService.getPacketDownload();
  }

  @Post('resolve-absence')
  @UseGuards(CoordinatorGuard)
  @ApiHeader({ name: 'x-demo-role', required: true, example: 'coordinator' })
  resolveAbsence(
    @Headers('x-demo-user') actor = 'Maya Chen',
    @Body() body: AssignSubstituteDto,
  ) {
    return this.appService.resolveAbsence(actor, body.memberId);
  }

  @Patch('members/:id/availability')
  @UseGuards(CoordinatorGuard)
  updateAvailability(
    @Headers('x-demo-user') actor: string,
    @Param('id') id: string,
    @Body() body: UpdateAvailabilityDto,
  ) {
    return this.appService.updateAvailability(
      actor || 'Maya Chen',
      id,
      body.available,
    );
  }

  @Put('repertoire/order')
  @UseGuards(CoordinatorGuard)
  reorderRepertoire(
    @Headers('x-demo-user') actor: string,
    @Body() body: ReorderRepertoireDto,
  ) {
    return this.appService.reorderRepertoire(
      actor || 'Maya Chen',
      body.itemIds,
    );
  }

  @Patch('instruments/:id/condition')
  @UseGuards(CoordinatorGuard)
  reportCondition(
    @Headers('x-demo-user') actor: string,
    @Param('id') id: string,
    @Body() body: ReportDamageDto,
  ) {
    return this.appService.reportCondition(
      actor || 'Maya Chen',
      id,
      body.condition,
      body.note,
    );
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

  @Post('jobs/:id/retry')
  @UseGuards(CoordinatorGuard)
  retryJob(@Headers('x-demo-user') actor: string, @Param('id') id: string) {
    return this.appService.retryJob(actor || 'Maya Chen', id);
  }

  @Post('jobs/recovery-drill')
  @UseGuards(CoordinatorGuard)
  startRecoveryDrill(@Headers('x-demo-user') actor: string) {
    return this.appService.startRecoveryDrill(actor || 'Maya Chen');
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
