import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '../../domain/entities/workflow.entity';

export class UpdateWorkflowDto {
  @ApiPropertyOptional({ description: 'Workflow name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Workflow description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Workflow definition (nodes/edges)' })
  @IsObject()
  @IsOptional()
  definition?: {
    nodes: any[];
    edges: any[];
    version: number;
  };

  @ApiPropertyOptional({ enum: WorkflowStatus })
  @IsEnum(WorkflowStatus)
  @IsOptional()
  status?: WorkflowStatus;
}
