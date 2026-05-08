import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class FetchEmailsDto {
  @ApiPropertyOptional({
    description: 'Mailbox to read. Examples: INBOX, [Gmail]/Sent Mail, [Gmail]/Spam',
    default: 'INBOX',
    example: 'INBOX',
  })
  @IsOptional()
  @IsString()
  mailbox?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of emails to return (max: 100)',
    default: 20,
    example: '20',
  })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({
    description:
      'Search filter using key:value pairs. Supported keys: from, to, subject, text, since (YYYY-MM-DD), before (YYYY-MM-DD)',
    example: 'subject:Candidature - Poste de Senior Developer',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Gmail address (uses IMAP_USER env if omitted)' })
  @IsOptional()
  @IsString()
  imapUser?: string;

  @ApiPropertyOptional({ description: 'Gmail App Password (uses IMAP_PASS env if omitted)' })
  @IsOptional()
  @IsString()
  imapPass?: string;

  @ApiPropertyOptional({ description: 'IMAP host', default: 'imap.gmail.com' })
  @IsOptional()
  @IsString()
  imapHost?: string;

  @ApiPropertyOptional({ description: 'IMAP port', default: '993' })
  @IsOptional()
  @IsNumberString()
  imapPort?: string;
}
