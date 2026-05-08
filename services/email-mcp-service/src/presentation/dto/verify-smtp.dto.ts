import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifySmtpDto {
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
}
