import { ApiProperty } from '@nestjs/swagger';

export class EmailSummaryDto {
  @ApiProperty({ example: '101' })
  uid!: string;

  @ApiProperty({ example: 'Alice <alice@example.com>' })
  from!: string;

  @ApiProperty({ example: 'Hello from MCP' })
  subject!: string;

  @ApiProperty({ example: '2024-05-08T12:34:56Z' })
  date!: string;

  @ApiProperty({ example: 'Just wanted to check in...' })
  snippet!: string;
}

export class FetchEmailsResultDto {
  @ApiProperty({ example: 1 })
  count!: number;

  @ApiProperty({ type: [EmailSummaryDto] })
  emails!: EmailSummaryDto[];
}
