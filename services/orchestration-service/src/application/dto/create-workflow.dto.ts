import { IsString, IsNotEmpty, IsObject, IsEnum, IsOptional } from 'class-validator';
import { WorkflowStatus } from '../../domain/entities/workflow.entity';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsNotEmpty()
  definition!: {
    nodes: any[];
    edges: any[];
    version: number;
  };

  @IsEnum(WorkflowStatus)
  @IsOptional()
  status?: WorkflowStatus = WorkflowStatus.DRAFT;
}
