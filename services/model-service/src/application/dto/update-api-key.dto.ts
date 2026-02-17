import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  keyName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
