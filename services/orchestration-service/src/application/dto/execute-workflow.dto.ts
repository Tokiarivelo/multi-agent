import { IsString, IsNotEmpty, IsOptional, IsObject, IsArray } from 'class-validator';

export class ExecuteWorkflowDto {
  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @IsObject()
  @IsOptional()
  input?: Record<string, any>;

  @IsArray()
  @IsOptional()
  disabledNodeTypes?: string[];
}
