import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetUserSettingsUseCase } from '../../application/use-cases/get-user-settings.use-case';
import { UpdateUserSettingsUseCase } from '../../application/use-cases/update-user-settings.use-case';

@ApiTags('User')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  constructor(
    private readonly getUserSettingsUseCase: GetUserSettingsUseCase,
    private readonly updateUserSettingsUseCase: UpdateUserSettingsUseCase,
  ) {}

  @Get('me/settings')
  @ApiOperation({ summary: 'Get current user settings' })
  async getSettings(@Req() req: any) {
    return this.getUserSettingsUseCase.execute(req.user.userId);
  }

  @Patch('me/settings')
  @ApiOperation({ summary: 'Update current user settings' })
  async updateSettings(@Req() req: any, @Body() body: { settings: any }) {
    return this.updateUserSettingsUseCase.execute(req.user.userId, body.settings);
  }
}
