import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GmailStopWatchDto {
  @ApiProperty({ description: 'Google OAuth2 refresh token for the target Gmail account' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
