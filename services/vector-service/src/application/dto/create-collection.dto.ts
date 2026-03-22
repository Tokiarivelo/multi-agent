import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  name!: string;

  @IsString()
  userId!: string;

  @IsNumber()
  @Min(1)
  dimension!: number;

  @IsEnum(['cosine', 'euclidean', 'dot'])
  @IsOptional()
  distance?: 'cosine' | 'euclidean' | 'dot';

  /** Model record ID from model-service to use for embeddings (optional) */
  @IsString()
  @IsOptional()
  embeddingModelId?: string;

  /** ApiKey record ID from model-service to use for embeddings (optional) */
  @IsString()
  @IsOptional()
  apiKeyId?: string;
}
