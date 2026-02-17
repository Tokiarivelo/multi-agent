import { IsOptional, IsEnum, IsBoolean, IsString } from 'class-validator';
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
}
