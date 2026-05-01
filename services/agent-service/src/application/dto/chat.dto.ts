import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChatAttachmentDto {
  @IsString()
  fileId: string;

  @IsString()
  name: string;

  @IsString()
  mimeType: string;

  @IsString()
  @IsOptional()
  url?: string;
}

export class CreateChatSessionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  workflowId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @IsString()
  @IsOptional()
  systemPrompt?: string;
}

export class UpdateChatSessionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  workflowId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @IsString()
  @IsOptional()
  systemPrompt?: string;
}

export class SendChatMessageDto {
  @IsString()
  content: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatAttachmentDto)
  @IsOptional()
  attachments?: ChatAttachmentDto[];
}
