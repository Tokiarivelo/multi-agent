import { Injectable, Logger } from '@nestjs/common';
import { ExecutionNodeFailedEvent } from '@multi-agent/events';
import { LogNodeExecutionUseCase } from '../../../application/use-cases/log-node-execution.use-case';

@Injectable()
export class ExecutionNodeFailedHandler {
  private readonly logger = new Logger(ExecutionNodeFailedHandler.name);

  constructor(private readonly logNodeExecutionUseCase: LogNodeExecutionUseCase) {}

  async handle(event: ExecutionNodeFailedEvent): Promise<void> {
    try {
      this.logger.log(`Handling execution.node.failed event`, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });

      await this.logNodeExecutionUseCase.logFailure(
        event.data.executionId,
        event.data.nodeId,
        event.data.error,
      );

      this.logger.log(`Node execution failed`, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle execution.node.failed event`, error, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });
      throw error;
    }
  }
}
