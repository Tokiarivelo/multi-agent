import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class EnvironmentVariables {
  @IsNumber()
  @Min(1024)
  @Max(65535)
  @IsOptional()
  PORT?: number = 3001;

  @IsString()
  @IsNotEmpty()
  NODE_ENV!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string = '*';

  @IsString()
  @IsNotEmpty()
  AGENT_SERVICE_URL!: string;

  @IsString()
  @IsNotEmpty()
  TOOL_SERVICE_URL!: string;

  @IsString()
  @IsOptional()
  EXECUTION_SERVICE_URL?: string;

  @IsNumber()
  @IsOptional()
  MAX_RETRY_ATTEMPTS?: number = 3;

  @IsNumber()
  @IsOptional()
  EXECUTION_TIMEOUT?: number = 300000; // 5 minutes
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
