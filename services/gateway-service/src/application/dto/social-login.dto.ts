import { IsEmail, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialLoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'google', description: 'OAuth provider name: google | github' })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Provider account ID for future account linking',
    required: false,
  })
  @IsString()
  @IsOptional()
  providerAccountId?: string;

  @ApiProperty({ example: 'http://example.com/avatar.jpg', required: false })
  @IsString()
  @IsOptional()
  image?: string;
}
