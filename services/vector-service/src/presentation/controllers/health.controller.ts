import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return {
      status: 'ok',
      service: 'vector-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  ready() {
    return {
      status: 'ready',
      service: 'vector-service',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return {
      status: 'live',
      service: 'vector-service',
      timestamp: new Date().toISOString(),
    };
  }
}
