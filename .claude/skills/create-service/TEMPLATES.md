# Service Scaffold Templates

All templates use these placeholders:
- `{{NAME}}` — kebab-case (e.g. `notification`)
- `{{PascalName}}` — PascalCase (e.g. `Notification`)
- `{{UPPER_NAME}}` — UPPER_SNAKE (e.g. `NOTIFICATION`)
- `{{SLUG}}` — plural kebab route (e.g. `notifications`)
- `{{PORT}}` — assigned port number
- `{{DESCRIPTION}}` — domain description

---

## `src/main.ts`
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './presentation/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('{{PascalName}} Service')
    .setDescription('{{DESCRIPTION}}')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? {{PORT}};
  await app.listen(port);
  logger.log(`{{PascalName}} Service running on port ${port}`);
}
bootstrap();
```

---

## `src/app.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { NatsModule } from './infrastructure/messaging/nats.module';
import { PrismaService } from '@multi-agent/database';
import { {{PascalName}}Repository } from './infrastructure/persistence/prisma-{{NAME}}.repository';
import { {{UPPER_NAME}}_REPOSITORY } from './domain/{{NAME}}.repository.interface';
import { Create{{PascalName}}UseCase } from './application/use-cases/create-{{NAME}}.use-case';
import { Get{{PascalName}}UseCase } from './application/use-cases/get-{{NAME}}.use-case';
import { List{{PascalName}}sUseCase } from './application/use-cases/list-{{NAME}}s.use-case';
import { Update{{PascalName}}UseCase } from './application/use-cases/update-{{NAME}}.use-case';
import { Delete{{PascalName}}UseCase } from './application/use-cases/delete-{{NAME}}.use-case';
import { {{PascalName}}Controller } from './presentation/controllers/{{NAME}}.controller';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [ConfigModule, NatsModule],
  controllers: [{{PascalName}}Controller, HealthController],
  providers: [
    PrismaService,
    Create{{PascalName}}UseCase,
    Get{{PascalName}}UseCase,
    List{{PascalName}}sUseCase,
    Update{{PascalName}}UseCase,
    Delete{{PascalName}}UseCase,
    { provide: {{UPPER_NAME}}_REPOSITORY, useClass: {{PascalName}}Repository },
  ],
})
export class AppModule {}
```

---

## `src/domain/{{NAME}}.entity.ts`
```typescript
export class {{PascalName}}Entity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    // TODO: add domain-specific fields
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static fromPrisma(data: { id: string; name: string; createdAt: Date; updatedAt: Date }): {{PascalName}}Entity {
    return new {{PascalName}}Entity(data.id, data.name, data.createdAt, data.updatedAt);
  }

  toPrisma(): { name: string } {
    return { name: this.name };
  }
}
```

---

## `src/domain/{{NAME}}.repository.interface.ts`
```typescript
import { {{PascalName}}Entity } from './{{NAME}}.entity';

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface I{{PascalName}}Repository {
  findById(id: string): Promise<{{PascalName}}Entity | null>;
  findAll(filters?: { page?: number; limit?: number }): Promise<Paginated<{{PascalName}}Entity>>;
  create(data: Omit<{{PascalName}}Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<{{PascalName}}Entity>;
  update(id: string, data: Partial<Omit<{{PascalName}}Entity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{{PascalName}}Entity>;
  delete(id: string): Promise<void>;
}

export const {{UPPER_NAME}}_REPOSITORY = Symbol('I{{PascalName}}Repository');
```

---

## `src/application/dto/create-{{NAME}}.dto.ts`
```typescript
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create{{PascalName}}Dto {
  @ApiProperty({ description: 'Name of the {{NAME}}', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // TODO: add domain-specific fields
}
```

---

## `src/application/dto/update-{{NAME}}.dto.ts`
```typescript
import { PartialType } from '@nestjs/swagger';
import { Create{{PascalName}}Dto } from './create-{{NAME}}.dto';

export class Update{{PascalName}}Dto extends PartialType(Create{{PascalName}}Dto) {}
```

---

## `src/application/dto/list-{{NAME}}.dto.ts`
```typescript
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class List{{PascalName}}Dto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

---

## `src/application/use-cases/create-{{NAME}}.use-case.ts`
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { I{{PascalName}}Repository, {{UPPER_NAME}}_REPOSITORY } from '../../domain/{{NAME}}.repository.interface';
import { {{PascalName}}Entity } from '../../domain/{{NAME}}.entity';
import { Create{{PascalName}}Dto } from '../dto/create-{{NAME}}.dto';

@Injectable()
export class Create{{PascalName}}UseCase {
  constructor(@Inject({{UPPER_NAME}}_REPOSITORY) private readonly repo: I{{PascalName}}Repository) {}

  async execute(dto: Create{{PascalName}}Dto): Promise<{{PascalName}}Entity> {
    return this.repo.create({ name: dto.name });
  }
}
```

---

## `src/application/use-cases/get-{{NAME}}.use-case.ts`
```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { I{{PascalName}}Repository, {{UPPER_NAME}}_REPOSITORY } from '../../domain/{{NAME}}.repository.interface';
import { {{PascalName}}Entity } from '../../domain/{{NAME}}.entity';

@Injectable()
export class Get{{PascalName}}UseCase {
  constructor(@Inject({{UPPER_NAME}}_REPOSITORY) private readonly repo: I{{PascalName}}Repository) {}

  async execute(id: string): Promise<{{PascalName}}Entity> {
    const entity = await this.repo.findById(id);
    if (!entity) throw new NotFoundException(`{{PascalName}} ${id} not found`);
    return entity;
  }
}
```

---

## `src/application/use-cases/list-{{NAME}}s.use-case.ts`
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { I{{PascalName}}Repository, {{UPPER_NAME}}_REPOSITORY, Paginated } from '../../domain/{{NAME}}.repository.interface';
import { {{PascalName}}Entity } from '../../domain/{{NAME}}.entity';
import { List{{PascalName}}Dto } from '../dto/list-{{NAME}}.dto';

@Injectable()
export class List{{PascalName}}sUseCase {
  constructor(@Inject({{UPPER_NAME}}_REPOSITORY) private readonly repo: I{{PascalName}}Repository) {}

  async execute(dto: List{{PascalName}}Dto): Promise<Paginated<{{PascalName}}Entity>> {
    return this.repo.findAll({ page: dto.page, limit: dto.limit });
  }
}
```

---

## `src/application/use-cases/update-{{NAME}}.use-case.ts`
```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { I{{PascalName}}Repository, {{UPPER_NAME}}_REPOSITORY } from '../../domain/{{NAME}}.repository.interface';
import { {{PascalName}}Entity } from '../../domain/{{NAME}}.entity';
import { Update{{PascalName}}Dto } from '../dto/update-{{NAME}}.dto';

@Injectable()
export class Update{{PascalName}}UseCase {
  constructor(@Inject({{UPPER_NAME}}_REPOSITORY) private readonly repo: I{{PascalName}}Repository) {}

  async execute(id: string, dto: Update{{PascalName}}Dto): Promise<{{PascalName}}Entity> {
    const exists = await this.repo.findById(id);
    if (!exists) throw new NotFoundException(`{{PascalName}} ${id} not found`);
    return this.repo.update(id, dto);
  }
}
```

---

## `src/application/use-cases/delete-{{NAME}}.use-case.ts`
```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { I{{PascalName}}Repository, {{UPPER_NAME}}_REPOSITORY } from '../../domain/{{NAME}}.repository.interface';

@Injectable()
export class Delete{{PascalName}}UseCase {
  constructor(@Inject({{UPPER_NAME}}_REPOSITORY) private readonly repo: I{{PascalName}}Repository) {}

  async execute(id: string): Promise<void> {
    const exists = await this.repo.findById(id);
    if (!exists) throw new NotFoundException(`{{PascalName}} ${id} not found`);
    await this.repo.delete(id);
  }
}
```

---

## `src/infrastructure/persistence/prisma-{{NAME}}.repository.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@multi-agent/database';
import { I{{PascalName}}Repository, Paginated } from '../../domain/{{NAME}}.repository.interface';
import { {{PascalName}}Entity } from '../../domain/{{NAME}}.entity';

@Injectable()
export class {{PascalName}}Repository implements I{{PascalName}}Repository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<{{PascalName}}Entity | null> {
    // TODO: replace `prisma.{{NAME}}` with actual Prisma model name after schema migration
    const record = await (this.prisma as any).{{NAME}}.findUnique({ where: { id } });
    return record ? {{PascalName}}Entity.fromPrisma(record) : null;
  }

  async findAll(filters?: { page?: number; limit?: number }): Promise<Paginated<{{PascalName}}Entity>> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;
    const [total, records] = await Promise.all([
      (this.prisma as any).{{NAME}}.count(),
      (this.prisma as any).{{NAME}}.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
    ]);
    return { data: records.map({{PascalName}}Entity.fromPrisma), total, page, limit };
  }

  async create(data: Omit<{{PascalName}}Entity, 'id' | 'createdAt' | 'updatedAt'>): Promise<{{PascalName}}Entity> {
    const record = await (this.prisma as any).{{NAME}}.create({ data });
    return {{PascalName}}Entity.fromPrisma(record);
  }

  async update(id: string, data: Partial<Omit<{{PascalName}}Entity, 'id' | 'createdAt' | 'updatedAt'>>): Promise<{{PascalName}}Entity> {
    const record = await (this.prisma as any).{{NAME}}.update({ where: { id }, data });
    return {{PascalName}}Entity.fromPrisma(record);
  }

  async delete(id: string): Promise<void> {
    await (this.prisma as any).{{NAME}}.delete({ where: { id } });
  }
}
```

---

## `src/infrastructure/config/config.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validate } from './env.validation';

@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, validate, envFilePath: ['.env.local', '.env'] })],
})
export class ConfigModule {}
```

---

## `src/infrastructure/config/env.validation.ts`
```typescript
import { plainToClass } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString() @IsNotEmpty()
  NODE_ENV: string = 'development';

  @IsNumber() @Min(1024) @Max(65535) @IsOptional()
  PORT?: number = {{PORT}};

  @IsString() @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString() @IsOptional()
  NATS_URL?: string = 'nats://localhost:4222';
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToClass(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) throw new Error(errors.toString());
  return validated;
}
```

---

## `src/infrastructure/messaging/nats.module.ts`
```typescript
import { Module, Global, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsClient } from '@multi-agent/nats-client';

@Global()
@Module({
  providers: [{
    provide: NatsClient,
    useFactory: (configService: ConfigService) =>
      new NatsClient(
        { servers: [configService.get<string>('NATS_URL', 'nats://localhost:4222')], maxReconnectAttempts: -1, reconnectTimeWait: 1000 },
        '{{NAME}}-service',
      ),
    inject: [ConfigService],
  }],
  exports: [NatsClient],
})
export class NatsModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NatsModule.name);
  constructor(private readonly natsClient: NatsClient) {}
  async onModuleInit() { await this.natsClient.connect(); this.logger.log('Connected to NATS'); }
  async onModuleDestroy() { await this.natsClient.close(); }
}
```

---

## `src/presentation/controllers/{{NAME}}.controller.ts`
```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Create{{PascalName}}UseCase } from '../../application/use-cases/create-{{NAME}}.use-case';
import { Get{{PascalName}}UseCase } from '../../application/use-cases/get-{{NAME}}.use-case';
import { List{{PascalName}}sUseCase } from '../../application/use-cases/list-{{NAME}}s.use-case';
import { Update{{PascalName}}UseCase } from '../../application/use-cases/update-{{NAME}}.use-case';
import { Delete{{PascalName}}UseCase } from '../../application/use-cases/delete-{{NAME}}.use-case';
import { Create{{PascalName}}Dto } from '../../application/dto/create-{{NAME}}.dto';
import { Update{{PascalName}}Dto } from '../../application/dto/update-{{NAME}}.dto';
import { List{{PascalName}}Dto } from '../../application/dto/list-{{NAME}}.dto';

@ApiTags('{{SLUG}}')
@Controller('{{SLUG}}')
export class {{PascalName}}Controller {
  constructor(
    private readonly createUseCase: Create{{PascalName}}UseCase,
    private readonly getUseCase: Get{{PascalName}}UseCase,
    private readonly listUseCase: List{{PascalName}}sUseCase,
    private readonly updateUseCase: Update{{PascalName}}UseCase,
    private readonly deleteUseCase: Delete{{PascalName}}UseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a {{NAME}}' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: Create{{PascalName}}Dto) { return this.createUseCase.execute(dto); }

  @Get()
  @ApiOperation({ summary: 'List {{SLUG}}' })
  findAll(@Query() query: List{{PascalName}}Dto) { return this.listUseCase.execute(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Get a {{NAME}} by ID' })
  findOne(@Param('id') id: string) { return this.getUseCase.execute(id); }

  @Put(':id')
  @ApiOperation({ summary: 'Update a {{NAME}}' })
  update(@Param('id') id: string, @Body() dto: Update{{PascalName}}Dto) { return this.updateUseCase.execute(id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a {{NAME}}' })
  remove(@Param('id') id: string) { return this.deleteUseCase.execute(id); }
}
```

---

## `src/presentation/controllers/health.controller.ts`
```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: '{{NAME}}-service', timestamp: new Date().toISOString() };
  }
}
```

---

## `src/presentation/filters/http-exception.filter.ts`
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : String(exception));
    }
    response.status(status).json({ success: false, statusCode: status, path: request.url, timestamp: new Date().toISOString(), error: message });
  }
}
```

---

## `test/{{NAME}}.e2e-spec.ts`
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('{{PascalName}} Service (e2e)', () => {
  let app: INestApplication;
  let created{{PascalName}}Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('GET /health returns ok', () =>
    request(app.getHttpServer()).get('/health').expect(200)
      .expect((res) => { expect(res.body.status).toBe('ok'); expect(res.body.service).toBe('{{NAME}}-service'); }),
  );

  it('POST /{{SLUG}} creates a {{NAME}}', () =>
    request(app.getHttpServer()).post('/{{SLUG}}').send({ name: 'test-{{NAME}}' }).expect(201)
      .expect((res) => { expect(res.body).toHaveProperty('id'); created{{PascalName}}Id = res.body.id; }),
  );

  it('GET /{{SLUG}} returns list', () =>
    request(app.getHttpServer()).get('/{{SLUG}}').expect(200)
      .expect((res) => { expect(res.body).toHaveProperty('data'); expect(res.body).toHaveProperty('total'); }),
  );

  it('GET /{{SLUG}}/:id returns a {{NAME}}', () =>
    request(app.getHttpServer()).get(`/{{SLUG}}/${created{{PascalName}}Id}`).expect(200)
      .expect((res) => expect(res.body.id).toBe(created{{PascalName}}Id)),
  );

  it('PUT /{{SLUG}}/:id updates a {{NAME}}', () =>
    request(app.getHttpServer()).put(`/{{SLUG}}/${created{{PascalName}}Id}`).send({ name: 'updated' }).expect(200),
  );

  it('DELETE /{{SLUG}}/:id removes a {{NAME}}', () =>
    request(app.getHttpServer()).delete(`/{{SLUG}}/${created{{PascalName}}Id}`).expect(204),
  );

  it('GET /{{SLUG}}/:id returns 404 after delete', () =>
    request(app.getHttpServer()).get(`/{{SLUG}}/${created{{PascalName}}Id}`).expect(404),
  );
});
```

---

## `test/jest-e2e.json`
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" }
}
```

---

## `package.json`
```json
{
  "name": "@multi-agent/{{NAME}}-service",
  "version": "1.0.0",
  "description": "{{DESCRIPTION}}",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@multi-agent/database": "workspace:*",
    "@multi-agent/nats-client": "workspace:*",
    "@multi-agent/types": "workspace:*",
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/swagger": "^7.1.17",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.2.1",
    "@nestjs/schematics": "^10.0.3",
    "@nestjs/testing": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.6",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.3.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

---

## `nest-cli.json`
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": { "deleteOutDir": true }
}
```

---

## `tsconfig.json`
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## `tsconfig.build.json`
```json
{ "extends": "./tsconfig.json", "exclude": ["node_modules", "test", "dist", "**/*spec.ts"] }
```

---

## `Dockerfile`
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE {{PORT}}
CMD ["node", "dist/main"]
```

---

## Gateway — `env.validation.ts` addition
```typescript
@IsString()
@IsOptional()
{{UPPER_NAME}}_SERVICE_URL?: string = 'http://localhost:{{PORT}}';
```

## Gateway — `proxy.controller.ts` addition
```typescript
case '{{SLUG}}':
  target = this.configService.get<string>('{{UPPER_NAME}}_SERVICE_URL', 'http://localhost:{{PORT}}');
  break;
```

## Prisma model
```prisma
model {{PascalName}} {
  id        String   @id @default(cuid())
  name      String
  // TODO: add domain-specific fields
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## NATS subjects
```typescript
export const {{UPPER_NAME}}_SUBJECTS = {
  CREATED: '{{SLUG}}.created',
  UPDATED: '{{SLUG}}.updated',
  DELETED: '{{SLUG}}.deleted',
} as const;
```

## `docker-compose.yml` entry
```yaml
{{NAME}}-service:
  build:
    context: ./services/{{NAME}}-service
    dockerfile: Dockerfile
  ports:
    - "{{PORT}}:{{PORT}}"
  environment:
    - PORT={{PORT}}
    - DATABASE_URL=${DATABASE_URL}
    - NATS_URL=nats://nats:4222
    - NODE_ENV=development
  depends_on:
    - postgres
    - nats
```
