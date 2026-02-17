import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ExecutionStatus } from '../../domain/entities/execution.entity';

export class UpdateExecutionDto {
  @IsEnum(ExecutionStatus)
  @IsOptional()
  status?: ExecutionStatus;

  @IsString()
  @IsOptional()
  error?: string;
}
