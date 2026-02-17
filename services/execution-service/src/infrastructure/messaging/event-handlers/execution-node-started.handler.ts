import { Injectable } from '@nestjs/common';
import { Logger } from '@multi-agent/common';
import { ExecutionNodeStartedEvent } from '@multi-agent/events';
import { LogNodeExecutionUseCase } from '../../../application/use-cases/log-node-execution.use-case';

@Injectable()
export class ExecutionNodeStartedHandler {
  private readonly logger = new Logger(ExecutionNodeStartedHandler.name);

  constructor(
    private readonly logNodeExecutionUseCase: LogNodeExecutionUseCase,
  ) {}

  async handle(event: ExecutionNodeStartedEvent): Promise<void> {
    try {
      this.logger.info(`Handling execution.node.started event`, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });

      await this.logNodeExecutionUseCase.logStart({
        id: `${event.data.executionId}-${event.data.nodeId}`,
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
        nodeName: event.data.nodeType,
        input: event.data.input,
      });

      this.logger.info(`Node execution started`, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });
    } catch (error) {
      this.logger.error(`Failed to handle execution.node.started event`, error, {
        executionId: event.data.executionId,
        nodeId: event.data.nodeId,
      });
      throw error;
    }
  }
}
