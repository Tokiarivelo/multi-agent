import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ToolAiService } from '@infrastructure/external/tool-ai.service';

@ApiTags('Tool AI')
@Controller('tools/ai')
export class ToolAiController {
  private readonly logger = new Logger(ToolAiController.name);

  constructor(private readonly toolAiService: ToolAiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a tool configuration from a natural-language description' })
  @ApiResponse({ status: 200, description: 'Generated tool configuration with session context' })
  async generate(
    @Body() body: { prompt: string; modelId: string; sessionId?: string },
  ) {
    if (!body.prompt?.trim()) throw new BadRequestException('prompt is required');
    if (!body.modelId?.trim()) throw new BadRequestException('modelId is required');

    this.logger.log(`Generating tool config with model ${body.modelId}`);
    return this.toolAiService.generateTool({
      prompt: body.prompt,
      modelId: body.modelId,
      sessionId: body.sessionId,
    });
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tool AI session' })
  @ApiParam({ name: 'sessionId', type: String })
  deleteSession(@Param('sessionId') sessionId: string) {
    const session = this.toolAiService.getSession(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.toolAiService.deleteSession(sessionId);
  }
}
