import { ApiProperty } from '@nestjs/swagger';

export class GmailWatchResultDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: '123456789', description: 'Initial historyId to start sync from' })
  historyId!: string;

  @ApiProperty({ example: '1715180400000', description: 'Expiration timestamp (epoch ms)' })
  expiration!: string;
}
