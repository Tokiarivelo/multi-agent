import { IsString, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ToolCategory } from '@domain/tool.entity';
import { ToolParameterDto } from './create-tool.dto';

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ToolCategory)
  category?: ToolCategory;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolParameterDto)
  parameters?: ToolParameterDto[];

  @IsOptional()
  @IsString()
  code?: string;
}
