import { IsString, IsNumber, IsArray, IsOptional, Min, Max, IsObject } from 'class-validator';

export class SearchDto {
  @IsString()
  collectionId!: string;

  @IsString()
  @IsOptional()
  query?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  embedding?: number[];

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @IsObject()
  @IsOptional()
  filter?: Record<string, any>;
}

export class SearchResultDto {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;

  constructor(id: string, score: number, content: string, metadata: Record<string, any>) {
    this.id = id;
    this.score = score;
    this.content = content;
    this.metadata = metadata;
  }
}
