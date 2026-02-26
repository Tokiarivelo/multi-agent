import { IsString, IsEnum, IsOptional, IsNumber, IsBoolean, IsObject, Min, Max } from 'class-validator';
import { ModelProvider } from '../../domain/entities/model.entity';

export class CreateModelDto {
  @IsString()
  name: string;

  @IsEnum(ModelProvider)
  provider: ModelProvider;

  @IsString()
  modelId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  supportsStreaming?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  defaultTemperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateLimitPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateLimitPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rateLimitPerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  inputCostPer1kTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outputCostPer1kTokens?: number;

  @IsOptional()
  @IsObject()
  providerSettings?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
