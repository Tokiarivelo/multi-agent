import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListAttachmentsDto {
  @ApiProperty({ description: 'UID of the email (from gmail_fetch_emails result)', example: '42' })
  @IsString()
  uid!: string;

  @ApiPropertyOptional({ description: 'Mailbox name', default: 'INBOX' })
  @IsOptional()
  @IsString()
  mailbox?: string;

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
  @IsString()
  imapPort?: string;
}
