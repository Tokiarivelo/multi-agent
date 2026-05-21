import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the requesting user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  async list(@Query('userId') userId: string, @Query('unreadOnly') unreadOnly?: string) {
    const where: any = { userId };
    if (unreadOnly === 'true') where.read = false;

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id', type: String })
  async markRead(@Param('id') id: string, @Query('userId') userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId) throw new ForbiddenException();

    await this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  @Put('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read for the user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  async markAllRead(@Query('userId') userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
