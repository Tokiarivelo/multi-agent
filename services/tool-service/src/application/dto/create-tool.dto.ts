import {
  IsString,
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsObject,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ToolCategory, ToolParameter } from '@domain/tool.entity';

export class McpConfigDto {
  @IsString()
  serverUrl: string;

  @IsString()
  toolName: string;

  @IsIn(['http', 'sse'])
  transport: 'http' | 'sse';

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

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
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isBuiltIn?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => McpConfigDto)
  mcpConfig?: McpConfigDto;

  @IsOptional()
  @IsString()
  repoFullName?: string;
}
