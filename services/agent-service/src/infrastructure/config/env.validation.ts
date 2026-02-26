import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, IsOptional, validateSync, Min, Max } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsOptional()
  NODE_ENV?: string = 'development';

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  PORT?: number = 3002;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  MODEL_SERVICE_URL?: string = 'http://localhost:3001';

  @IsString()
  @IsOptional()
  TOOL_SERVICE_URL?: string = 'http://localhost:3003';

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  @IsString()
  @IsOptional()
  GOOGLE_API_KEY?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  MAX_TOKENS_PER_REQUEST?: number = 4000;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  REQUEST_TIMEOUT_MS?: number = 60000;

  @IsString()
  @IsOptional()
  WS_CORS_ORIGIN?: string = '*';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  
  return validatedConfig;
}
