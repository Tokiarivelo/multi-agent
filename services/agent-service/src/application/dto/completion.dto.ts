import { IsString, IsArray, ValidateNested, IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CompletionMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @IsString()
  content: string;
}

export class CompletionDto {
  @IsString()
  modelId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletionMessageDto)
  messages: CompletionMessageDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;
}
