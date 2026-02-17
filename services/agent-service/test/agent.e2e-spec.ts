import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AgentController (e2e)', () => {
  let app: INestApplication;
  let createdAgentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/agents (POST)', () => {
    it('should create a new agent', () => {
      return request(app.getHttpServer())
        .post('/api/agents')
        .send({
          name: 'Test Agent',
          description: 'A test agent',
          modelId: 'gpt-4',
          systemPrompt: 'You are a helpful assistant',
          temperature: 0.7,
          maxTokens: 2000,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Agent');
          createdAgentId = res.body.id;
        });
    });

    it('should reject invalid agent data', () => {
      return request(app.getHttpServer())
        .post('/api/agents')
        .send({
          name: '',
          modelId: '',
        })
        .expect(400);
    });
  });

  describe('/api/agents (GET)', () => {
    it('should return list of agents', () => {
      return request(app.getHttpServer())
        .get('/api/agents')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter agents by name', () => {
      return request(app.getHttpServer())
        .get('/api/agents?name=Test')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/api/agents/:id (GET)', () => {
    it('should return agent by id', () => {
      return request(app.getHttpServer())
        .get(`/api/agents/${createdAgentId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdAgentId);
        });
    });

    it('should return 404 for non-existent agent', () => {
      return request(app.getHttpServer())
        .get('/api/agents/non-existent-id')
        .expect(404);
    });
  });

  describe('/api/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.service).toBe('agent-service');
        });
    });
  });
});
