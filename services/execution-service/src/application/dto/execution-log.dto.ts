import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class ExecutionLogDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  executionId!: string;

  @IsString()
  @IsNotEmpty()
  nodeId!: string;

  @IsString()
  @IsNotEmpty()
  nodeName!: string;

  @IsObject()
  @IsOptional()
  input?: Record<string, any>;

  @IsObject()
  @IsOptional()
  output?: Record<string, any>;

  @IsString()
  @IsOptional()
  error?: string;
}
