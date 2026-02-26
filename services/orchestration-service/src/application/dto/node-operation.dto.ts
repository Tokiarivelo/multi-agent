import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NodeType } from '../../domain/entities/workflow.entity';

export class AddNodeDto {
  @ApiProperty({ description: 'Unique node ID (client-generated UUID)' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ enum: NodeType, description: 'Node type' })
  @IsString()
  @IsNotEmpty()
  type!: NodeType;

  @ApiPropertyOptional({ description: 'Node configuration object' })
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Custom node name' })
  @IsString()
  @IsOptional()
  customName?: string;

  @ApiPropertyOptional({ description: 'Visual position on canvas' })
  @IsOptional()
  position?: { x: number; y: number };
}

export class UpdateNodeDto {
  @ApiPropertyOptional({ enum: NodeType })
  @IsString()
  @IsOptional()
  type?: NodeType;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  config?: Record<string, any>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  position?: { x: number; y: number };
}

export class AddEdgeDto {
  @ApiProperty({ description: 'Unique edge ID' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  source!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  target!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  condition?: string;
}
