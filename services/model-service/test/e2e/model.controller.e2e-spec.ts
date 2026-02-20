import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

describe('ModelController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.model.deleteMany();
  });

  describe('/api/models (POST)', () => {
    it('should create a new model', () => {
      return request(app.getHttpServer())
        .post('/api/models')
        .send({
          name: 'gpt-4-turbo',
          provider: 'OPENAI',
          modelId: 'gpt-4-turbo-preview',
          modelName: 'GPT-4 Turbo Preview',
          maxTokens: 128000,
          defaultTemperature: 0.7,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('gpt-4-turbo');
          expect(res.body.provider).toBe('OPENAI');
        });
    });

    it('should return 400 for invalid provider', () => {
      return request(app.getHttpServer())
        .post('/api/models')
        .send({
          name: 'invalid-model',
          provider: 'INVALID',
          modelId: 'test',
          modelName: 'Invalid Model',
        })
        .expect(400);
    });

    it('should return 409 for duplicate model name', async () => {
      await request(app.getHttpServer()).post('/api/models').send({
        name: 'gpt-4',
        provider: 'OPENAI',
        modelId: 'gpt-4',
        modelName: 'GPT-4',
      });

      return request(app.getHttpServer())
        .post('/api/models')
        .send({
          name: 'gpt-4',
          provider: 'OPENAI',
          modelId: 'gpt-4-other',
          modelName: 'GPT-4 Other',
        })
        .expect(409);
    });
  });

  describe('/api/models (GET)', () => {
    beforeEach(async () => {
      await prisma.model.createMany({
        data: [
          {
            name: 'gpt-4',
            provider: 'OPENAI',
            modelId: 'gpt-4',
            modelName: 'GPT-4',
            maxTokens: 8000,
            supportsStreaming: true,
          },
          {
            name: 'claude-3-opus',
            provider: 'ANTHROPIC',
            modelId: 'claude-3-opus-20240229',
            modelName: 'Claude 3 Opus',
            maxTokens: 200000,
            supportsStreaming: true,
          },
        ],
      });
    });

    it('should list all models', () => {
      return request(app.getHttpServer())
        .get('/api/models')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body).toHaveLength(2);
        });
    });

    it('should filter models by provider', () => {
      return request(app.getHttpServer())
        .get('/api/models?provider=OPENAI')
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].provider).toBe('OPENAI');
        });
    });
  });

  describe('/api/models/:id (GET)', () => {
    it('should get a model by id', async () => {
      const model = await prisma.model.create({
        data: {
          name: 'gpt-4',
          provider: 'OPENAI',
          modelId: 'gpt-4',
          modelName: 'GPT-4',
          maxTokens: 8000,
          supportsStreaming: true,
        },
      });

      return request(app.getHttpServer())
        .get(`/api/models/${model.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(model.id);
          expect(res.body.name).toBe('gpt-4');
        });
    });

    it('should return 404 for non-existent model', () => {
      return request(app.getHttpServer()).get('/api/models/non-existent-id').expect(404);
    });
  });

  describe('/api/models/:id (PUT)', () => {
    it('should update a model', async () => {
      const model = await prisma.model.create({
        data: {
          name: 'gpt-4',
          provider: 'OPENAI',
          modelId: 'gpt-4',
          modelName: 'GPT-4',
          maxTokens: 8000,
          supportsStreaming: true,
        },
      });

      return request(app.getHttpServer())
        .put(`/api/models/${model.id}`)
        .send({
          maxTokens: 10000,
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.maxTokens).toBe(10000);
          expect(res.body.description).toBe('Updated description');
        });
    });
  });

  describe('/api/models/:id (DELETE)', () => {
    it('should delete a model', async () => {
      const model = await prisma.model.create({
        data: {
          name: 'gpt-4',
          provider: 'OPENAI',
          modelId: 'gpt-4',
          modelName: 'GPT-4',
          maxTokens: 8000,
          supportsStreaming: true,
        },
      });

      await request(app.getHttpServer()).delete(`/api/models/${model.id}`).expect(204);

      const deletedModel = await prisma.model.findUnique({
        where: { id: model.id },
      });
      expect(deletedModel).toBeNull();
    });
  });
});
