import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateExecutionDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
