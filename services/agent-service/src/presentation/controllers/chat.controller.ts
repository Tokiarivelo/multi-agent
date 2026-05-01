import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatSessionUseCase } from '../../application/use-cases/chat-session.use-case';
import { ChatMessageUseCase } from '../../application/use-cases/chat-message.use-case';
import {
  CreateChatSessionDto,
  UpdateChatSessionDto,
} from '../../application/dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatSessionUseCase: ChatSessionUseCase,
    private readonly chatMessageUseCase: ChatMessageUseCase,
  ) {}

  @Get('sessions')
  listSessions(@Query('userId') userId: string) {
    return this.chatSessionUseCase.listSessions(userId);
  }

  @Post('sessions')
  createSession(@Query('userId') userId: string, @Body() dto: CreateChatSessionDto) {
    return this.chatSessionUseCase.createSession(userId, dto);
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string, @Query('userId') userId: string) {
    return this.chatSessionUseCase.getSession(id, userId);
  }

  @Patch('sessions/:id')
  updateSession(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: UpdateChatSessionDto,
  ) {
    return this.chatSessionUseCase.updateSession(id, userId, dto);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession(@Param('id') id: string, @Query('userId') userId: string) {
    return this.chatSessionUseCase.deleteSession(id, userId);
  }

  @Get('sessions/:id/messages')
  getMessages(@Param('id') id: string, @Query('userId') userId: string) {
    return this.chatMessageUseCase.getMessages(id, userId);
  }
}
