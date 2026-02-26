import { IsString, IsOptional, IsNumber, IsArray, Min, Max } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  modelId: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxTokens?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tools?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}
