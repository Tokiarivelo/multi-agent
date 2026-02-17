import { IsString, IsObject, IsOptional, IsNumber } from 'class-validator';

export class ExecuteToolDto {
  @IsString()
  toolId: string;

  @IsObject()
  parameters: Record<string, any>;

  @IsOptional()
  @IsNumber()
  timeout?: number;

  @IsOptional()
  @IsString()
  userId?: string;
}
