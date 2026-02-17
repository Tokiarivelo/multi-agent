import { IsString, IsEnum, IsArray, IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ToolCategory, ToolParameter } from '@domain/tool.entity';

export class ToolParameterDto implements ToolParameter {
  @IsString()
  name: string;

  @IsEnum(['string', 'number', 'boolean', 'object', 'array'])
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  @IsString()
  description: string;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  default?: any;
}

export class CreateToolDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(ToolCategory)
  category: ToolCategory;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ToolParameterDto)
  parameters: ToolParameterDto[];

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isBuiltIn?: boolean;
}
