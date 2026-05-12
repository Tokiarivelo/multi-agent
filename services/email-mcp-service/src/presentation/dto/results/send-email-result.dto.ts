import { ApiProperty } from '@nestjs/swagger';

export class SendEmailResultDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: '<12345.6789@smtp.gmail.com>', description: 'SMTP message identifier' })
  messageId!: string;
}
