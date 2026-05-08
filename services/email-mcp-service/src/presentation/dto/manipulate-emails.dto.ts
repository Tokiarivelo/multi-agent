import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum EmailAction {
  MARK_READ = 'mark_read',
  MARK_UNREAD = 'mark_unread',
  MOVE = 'move',
  DELETE = 'delete',
}

export class ManipulateEmailsDto {
  @ApiProperty({
    description: 'Array of email UIDs to manipulate',
    example: [101, 102],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  uids!: number[];

  @ApiProperty({
    description: 'Action to perform on the specified emails',
    enum: EmailAction,
    example: EmailAction.MARK_READ,
  })
  @IsEnum(EmailAction)
  action!: EmailAction;

  @ApiPropertyOptional({
    description: 'Mailbox where the emails currently reside',
    default: 'INBOX',
  })
  @IsOptional()
  @IsString()
  mailbox?: string;

  @ApiPropertyOptional({
    description: 'Target mailbox for the "move" action (e.g. [Gmail]/Archive)',
  })
  @IsOptional()
  @IsString()
  targetMailbox?: string;

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
