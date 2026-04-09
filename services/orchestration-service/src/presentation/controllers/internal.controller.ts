import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WorkflowGateway } from '../gateways/workflow.gateway';

export interface TokenProgressDto {
  executionId: string;
  nodeId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
  iteration: number;
}

/**
 * Internal-only endpoints called by other services (not exposed externally).
 * The gateway proxy does not route /internal/* to this service.
 */
@Controller('internal')
export class InternalController {
  constructor(private readonly workflowGateway: WorkflowGateway) {}

  @Post('token-progress')
  @HttpCode(HttpStatus.NO_CONTENT)
  reportTokenProgress(@Body() dto: TokenProgressDto): void {
    this.workflowGateway.sendNodeTokenUpdate(dto.executionId, dto.nodeId, {
      inputTokens: dto.inputTokens,
      outputTokens: dto.outputTokens,
      totalTokens: dto.totalTokens,
      model: dto.model,
      iteration: dto.iteration,
    });
  }
}
