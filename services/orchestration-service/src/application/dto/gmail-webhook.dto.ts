import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Pub/Sub push message wrapper sent by Google to our webhook endpoint.
 * Google wraps the actual Pub/Sub message in this envelope.
 *
 * @see https://cloud.google.com/pubsub/docs/push#receive_push
 */
export class PubSubMessageDto {
  /** Base64-encoded Pub/Sub message data. Decoded JSON contains { emailAddress, historyId }. */
  @ApiProperty({ description: 'Base64-encoded message payload from Google Pub/Sub' })
  @IsString()
  @IsNotEmpty()
  data!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  messageId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  publishTime?: string;
}

export class PubSubPushDto {
  @ApiProperty({ type: PubSubMessageDto })
  message!: PubSubMessageDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subscription?: string;
}

/** The decoded payload Google puts inside the base64-encoded Pub/Sub message data field. */
export interface GmailPushPayload {
  /** Gmail address of the account that triggered the notification */
  emailAddress: string;
  /** The new historyId — represents state *after* the new messages */
  historyId: number;
}

/** DTO for registering/linking a Gmail watch subscription to a workflow. */
export class RegisterGmailWatchDto {
  @ApiProperty({ description: 'Workflow ID to trigger when a new email arrives' })
  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @ApiProperty({ description: 'User ID that owns this workflow' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({
    description: 'Gmail address being watched (must match gmailUser from watch registration)',
  })
  @IsString()
  @IsNotEmpty()
  gmailUser!: string;

  @ApiProperty({ description: 'Google Cloud Pub/Sub topic name used when calling gmail_watch' })
  @IsString()
  @IsNotEmpty()
  topicName!: string;

  @ApiPropertyOptional({
    description: 'Gmail label IDs to watch (default: ["INBOX"])',
    type: [String],
  })
  @IsOptional()
  labelIds?: string[];

  @ApiPropertyOptional({
    description: 'historyId returned by gmail_watch (used for delta history fetching)',
  })
  @IsString()
  @IsOptional()
  historyId?: string;

  @ApiPropertyOptional({ description: 'expiration timestamp (epoch ms) returned by gmail_watch' })
  @IsString()
  @IsOptional()
  expiration?: string;

  @ApiPropertyOptional({
    description:
      'OAuth2 refresh token for the watched Gmail account (used for History API condition evaluation)',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;

  @ApiPropertyOptional({
    description:
      'Conditions to filter which emails trigger the workflow. All conditions are ANDed.',
    type: 'object',
    properties: {
      fromContains: { type: 'string', description: 'Trigger only if sender contains this string' },
      subjectContains: {
        type: 'string',
        description: 'Trigger only if subject contains this string',
      },
      bodyContains: {
        type: 'string',
        description: 'Trigger only if email body/snippet contains this string',
      },
      hasAttachment: {
        type: 'boolean',
        description: 'Trigger only if the email has (or has no) attachment',
      },
    },
  })
  @IsObject()
  @IsOptional()
  @Type(() => Object)
  conditions?: {
    fromContains?: string;
    subjectContains?: string;
    bodyContains?: string;
    hasAttachment?: boolean;
  };
}

export class UnregisterGmailWatchDto {
  @ApiProperty({ description: 'Workflow ID to unregister' })
  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @ApiProperty({ description: 'Gmail address to stop watching' })
  @IsString()
  @IsNotEmpty()
  gmailUser!: string;
}
