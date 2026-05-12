import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class GmailPullNotificationsDto {
  @ApiProperty({
    description: 'Google Cloud Project ID',
    example: 'my-project-123',
  })
  @IsString()
  projectId: string;

  @ApiProperty({
    description: 'Subscription name (not full path)',
    example: 'gmail-notifications-sub',
  })
  @IsString()
  subscriptionName: string;

  @ApiProperty({
    description: 'Maximum number of messages to pull',
    example: '10',
    required: false,
    default: '10',
  })
  @IsOptional()
  @IsNumberString()
  maxMessages?: string;

  @ApiProperty({
    description: 'Path to Google Cloud credentials JSON file',
    required: false,
  })
  @IsOptional()
  @IsString()
  credentialsPath?: string;
}
