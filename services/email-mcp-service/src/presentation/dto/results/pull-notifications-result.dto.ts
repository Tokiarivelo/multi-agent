import { ApiProperty } from '@nestjs/swagger';

class GmailNotificationDto {
  @ApiProperty({
    description: 'Email address that received the notification',
    example: 'user@gmail.com',
  })
  emailAddress: string;

  @ApiProperty({
    description: 'Gmail history ID (use with Gmail History API to fetch message details)',
    example: '1234567',
  })
  historyId: string;
}

export class PullNotificationsResultDto {
  @ApiProperty({
    description: 'Number of notifications retrieved',
    example: 3,
  })
  count: number;

  @ApiProperty({
    description: 'List of Gmail notifications',
    type: [GmailNotificationDto],
  })
  notifications: GmailNotificationDto[];
}
