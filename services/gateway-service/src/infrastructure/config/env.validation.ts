import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class EnvironmentVariables {
  @IsNumber()
  @Min(1024)
  @Max(65535)
  @IsOptional()
  PORT?: number = 3000;

  @IsString()
  @IsNotEmpty()
  NODE_ENV!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION?: string = '1d';

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string = '*';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = new EnvironmentVariables();
  Object.assign(validatedConfig, config);

  return validatedConfig;
}
