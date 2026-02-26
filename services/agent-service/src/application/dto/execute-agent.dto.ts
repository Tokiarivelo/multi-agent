import { IsString, IsOptional, IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageDto {
  @IsString()
  role: 'system' | 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ExecuteAgentDto {
  @IsString()
  input: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  conversationHistory?: MessageDto[];

  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}
