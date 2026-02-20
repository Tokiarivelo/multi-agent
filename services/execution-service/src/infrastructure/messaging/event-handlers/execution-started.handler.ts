import { Injectable, Logger } from '@nestjs/common';
import {
  ExecutionStartedEvent,
  ExecutionCompletedEvent,
  ExecutionFailedEvent,
} from '@multi-agent/events';
import { CreateExecutionUseCase } from '../../../application/use-cases/create-execution.use-case';
import { UpdateExecutionStatusUseCase } from '../../../application/use-cases/update-execution-status.use-case';
import { ExecutionStatus } from '../../../domain/entities/execution.entity';

@Injectable()
export class ExecutionStartedHandler {
  private readonly logger = new Logger(ExecutionStartedHandler.name);

  constructor(
    private readonly createExecutionUseCase: CreateExecutionUseCase,
    private readonly updateExecutionStatusUseCase: UpdateExecutionStatusUseCase,
  ) {}

  async handle(event: ExecutionStartedEvent): Promise<void> {
    try {
      this.logger.log(`Handling execution.started event`, { executionId: event.data.executionId });

      // Create execution record
      await this.createExecutionUseCase.execute({
        id: event.data.executionId,
        workflowId: event.data.workflowId,
        userId: event.data.userId,
        metadata: {},
      });

      // Update status to running
      await this.updateExecutionStatusUseCase.execute(
        event.data.executionId,
        ExecutionStatus.RUNNING,
      );

      this.logger.log(`Execution created and started`, { executionId: event.data.executionId });
    } catch (error) {
      this.logger.error(`Failed to handle execution.started event`, error, {
        executionId: event.data.executionId,
      });
      throw error;
    }
  }

  async handleCompleted(event: ExecutionCompletedEvent): Promise<void> {
    try {
      this.logger.log(`Handling execution.completed event`, {
        executionId: event.data.executionId,
      });

      await this.updateExecutionStatusUseCase.execute(
        event.data.executionId,
        ExecutionStatus.COMPLETED,
      );

      this.logger.log(`Execution completed`, { executionId: event.data.executionId });
    } catch (error) {
      this.logger.error(`Failed to handle execution.completed event`, error, {
        executionId: event.data.executionId,
      });
      throw error;
    }
  }

  async handleFailed(event: ExecutionFailedEvent): Promise<void> {
    try {
      this.logger.log(`Handling execution.failed event`, { executionId: event.data.executionId });

      await this.updateExecutionStatusUseCase.execute(
        event.data.executionId,
        ExecutionStatus.FAILED,
        event.data.error,
      );

      this.logger.log(`Execution failed`, { executionId: event.data.executionId });
    } catch (error) {
      this.logger.error(`Failed to handle execution.failed event`, error, {
        executionId: event.data.executionId,
      });
      throw error;
    }
  }
}
