import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class GmailFetchHistoryDto {
  @ApiProperty({ description: 'OAuth2 refresh token for the Gmail account' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;

  @ApiProperty({ description: 'Start historyId — fetch messages added after this point' })
  @IsString()
  @IsNotEmpty()
  startHistoryId!: string;

  @ApiPropertyOptional({ description: 'Max messages to return (default: 50)', default: 50 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxResults?: number;
}
