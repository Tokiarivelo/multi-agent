import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @ApiProperty({ description: 'Attachment file name' })
  @IsString()
  filename!: string;

  @ApiPropertyOptional({ description: 'URL or local path to the file' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: 'Inline content (text or base64)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'MIME type (e.g. application/pdf)' })
  @IsOptional()
  @IsString()
  contentType?: string;
}

export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient address(es), comma-separated',
    example: 'alice@example.com',
  })
  @IsString()
  to!: string;

  @ApiProperty({ description: 'Email subject line', example: 'Hello from MCP' })
  @IsString()
  subject!: string;

  @ApiPropertyOptional({ description: 'Plain-text body' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ description: 'HTML body (overrides body if provided)' })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({ description: 'Sender address (uses SMTP_FROM env if omitted)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'SMTP host (uses SMTP_HOST env if omitted)' })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ description: 'SMTP port (uses SMTP_PORT env if omitted)' })
  @IsOptional()
  @IsString()
  smtpPort?: string;

  @ApiPropertyOptional({ description: 'SMTP user (uses SMTP_USER env if omitted)' })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional({ description: 'SMTP password (uses SMTP_PASS env if omitted)' })
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @ApiPropertyOptional({ type: [AttachmentDto], description: 'List of attachments' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}
