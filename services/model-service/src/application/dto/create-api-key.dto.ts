import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ModelProvider } from '../../domain/entities/model.entity';

export class CreateApiKeyDto {
  @IsString()
  userId: string;

  @IsEnum(ModelProvider)
  provider: ModelProvider;

  @IsString()
  keyName: string;

  @IsString()
  apiKey: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
