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
import { AgentAiService } from '../../infrastructure/external/agent-ai.service';

@ApiTags('Agent AI')
@Controller('agents/ai')
export class AgentAiController {
  private readonly logger = new Logger(AgentAiController.name);

  constructor(private readonly agentAiService: AgentAiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate an agent configuration from a natural-language description' })
  @ApiResponse({ status: 200, description: 'Generated agent configuration with session context' })
  async generate(
    @Body() body: { prompt: string; modelId: string; sessionId?: string },
  ) {
    if (!body.prompt?.trim()) throw new BadRequestException('prompt is required');
    if (!body.modelId?.trim()) throw new BadRequestException('modelId is required');

    this.logger.log(`Generating agent config with model ${body.modelId}`);
    return this.agentAiService.generateAgent({
      prompt: body.prompt,
      modelId: body.modelId,
      sessionId: body.sessionId,
    });
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent AI session' })
  @ApiParam({ name: 'sessionId', type: String })
  deleteSession(@Param('sessionId') sessionId: string) {
    const session = this.agentAiService.getSession(sessionId);
    if (!session) throw new NotFoundException(`Session ${sessionId} not found`);
    this.agentAiService.deleteSession(sessionId);
  }
}
