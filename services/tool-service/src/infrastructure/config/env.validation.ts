import { plainToClass } from 'class-transformer';
import { IsString, IsNumber, IsBoolean, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  NODE_ENV: string = 'development';

  @IsNumber()
  PORT: number = 3003;

  @IsString()
  DATABASE_URL: string;

  @IsNumber()
  TOOL_EXECUTION_TIMEOUT: number = 30000;

  @IsNumber()
  MAX_TOOL_MEMORY_MB: number = 128;

  @IsBoolean()
  ENABLE_FILE_OPERATIONS: boolean = true;

  @IsString()
  ALLOWED_DOMAINS: string = '*';

  @IsNumber()
  THROTTLE_TTL: number = 60;

  @IsNumber()
  THROTTLE_LIMIT: number = 30;

  @IsBoolean()
  SANDBOX_ENABLED: boolean = true;
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
