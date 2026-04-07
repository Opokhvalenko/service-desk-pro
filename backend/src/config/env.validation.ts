import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  PORT = 3000;

  @IsString()
  API_PREFIX = 'api/v1';

  @IsString()
  CORS_ORIGIN!: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DIRECT_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  JWT_REFRESH_TTL = '7d';

  @IsString()
  COOKIE_DOMAIN = 'localhost';

  @IsString()
  COOKIE_SECURE = 'false';

  @IsString()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  CLOUDINARY_API_SECRET!: string;

  @IsString()
  CLOUDINARY_UPLOAD_PRESET!: string;

  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsString()
  SENTRY_ENVIRONMENT = 'development';

  @IsOptional()
  @IsString()
  OTEL_SERVICE_NAME?: string;

  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  OTEL_EXPORTER_OTLP_HEADERS?: string;

  @IsString()
  MAIL_HOST = 'localhost';

  @Type(() => Number)
  @IsNumber()
  MAIL_PORT = 1025;

  @IsString()
  MAIL_FROM = 'noreply@service-desk-pro.com';

  @Type(() => Number)
  @IsNumber()
  THROTTLE_TTL = 60;

  @Type(() => Number)
  @IsNumber()
  THROTTLE_LIMIT = 100;

  @IsString()
  LOG_LEVEL = 'info';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return validated;
}
