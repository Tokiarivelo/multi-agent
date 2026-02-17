import { Injectable } from '@nestjs/common';
import { Logger } from '@multi-agent/common';
import { ExecutionNodeCompletedEvent } from '@multi-agent/events';
import { LogNodeExecutionUseCase } from '../../../application/use-cases/log-node-execution.use-case';

@Injectable()
export class ExecutionNodeCompletedHandler {
  private readonly logger = new Logger(ExecutionNodeCompletedHandler.name);

  constructor(
    private readonly logNodeExecutionUseCase: LogNodeExecutionUseCase,
  ) {}

  async handle(event: ExecutionNodeCompletedEvent): Promise<void> {
    try {
      this.logger.info(`Handling execution.node.completed event`, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });

      await this.logNodeExecutionUseCase.logComplete(
        event.data.executionId,
        event.data.nodeId,
        event.data.output,
      );

      this.logger.info(`Node execution completed`, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle execution.node.completed event`, error, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });
      throw error;
    }
  }
}
