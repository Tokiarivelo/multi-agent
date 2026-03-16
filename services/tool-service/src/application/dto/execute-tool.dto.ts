import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';

export class ExecuteToolDto {
  @IsOptional()
  @IsString()
  toolId?: string;

  @IsOptional()
  @IsString()
  toolName?: string;

  @IsObject()
  parameters: Record<string, any>;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}
