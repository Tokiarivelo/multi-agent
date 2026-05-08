import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

export class SendEmailTemplateDto {
  @ApiProperty({
    description: 'Recipient address(es), comma-separated',
    example: 'alice@example.com',
  })
  @IsString()
  to!: string;

  @ApiProperty({
    description: 'Subject — supports {{variable}} placeholders',
    example: 'Hello {{name}}',
  })
  @IsString()
  subject!: string;

  @ApiProperty({
    description: 'HTML or plain-text template body — supports {{variable}} placeholders',
    example: '<p>Dear {{name}}, your order {{orderId}} is ready.</p>',
  })
  @IsString()
  template!: string;

  @ApiPropertyOptional({
    description: 'Key-value pairs for placeholder substitution',
    example: { name: 'Alice', orderId: '12345' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Sender address (uses SMTP_FROM env if omitted)' })
  @IsOptional()
  @IsString()
  from?: string;
}
