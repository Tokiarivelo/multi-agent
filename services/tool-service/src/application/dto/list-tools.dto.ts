import { IsOptional, IsEnum, IsBoolean, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ToolCategory } from '@domain/tool.entity';

export class ListToolsDto {
  @IsOptional()
  @IsEnum(ToolCategory)
  category?: ToolCategory;

  @IsOptional()
  @IsBoolean()
  isBuiltIn?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}
