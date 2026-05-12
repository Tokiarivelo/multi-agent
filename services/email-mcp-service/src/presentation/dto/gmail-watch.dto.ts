import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GmailWatchDto {
  @ApiProperty({ description: 'Google OAuth2 refresh token for the target Gmail account' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;

  @ApiProperty({
    description:
      'The Google Cloud Pub/Sub topic to publish to (format: projects/{project}/topics/{topic})',
    example: 'projects/my-gcp-project/topics/gmail-push',
  })
  @IsString()
  @IsNotEmpty()
  topicName!: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated Gmail label IDs to watch (e.g. "INBOX,UNREAD"). Defaults to INBOX.',
    example: 'INBOX',
  })
  @IsString()
  @IsOptional()
  labelIds?: string;
}
