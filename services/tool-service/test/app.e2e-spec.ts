import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tool Service (e2e)', () => {
  let app: INestApplication;
  let createdToolId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('service', 'tool-service');
        });
    });
  });

  describe('Tool Management', () => {
    it('/tools (POST) - should create a new tool', () => {
      return request(app.getHttpServer())
        .post('/tools')
        .send({
          name: 'test_tool',
          description: 'A test tool',
          category: 'CUSTOM',
          parameters: [
            {
              name: 'input',
              type: 'string',
              description: 'Test input',
              required: true,
            },
          ],
          code: 'const { input } = parameters; return input.toUpperCase();',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('name', 'test_tool');
          createdToolId = res.body.id;
        });
    });

    it('/tools (GET) - should list all tools', () => {
      return request(app.getHttpServer())
        .get('/tools')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('/tools/:id (GET) - should get a specific tool', () => {
      return request(app.getHttpServer())
        .get(`/tools/${createdToolId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', createdToolId);
          expect(res.body).toHaveProperty('name', 'test_tool');
        });
    });

    it('/tools/:id (PUT) - should update a tool', () => {
      return request(app.getHttpServer())
        .put(`/tools/${createdToolId}`)
        .send({
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('description', 'Updated description');
        });
    });
  });

  describe('Tool Execution', () => {
    it('/tools/execute (POST) - should execute a tool', () => {
      return request(app.getHttpServer())
        .post('/tools/execute')
        .send({
          toolId: createdToolId,
          parameters: {
            input: 'hello',
          },
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('data', 'HELLO');
          expect(res.body).toHaveProperty('executionTime');
        });
    });

    it('/tools/execute (POST) - should fail with invalid parameters', () => {
      return request(app.getHttpServer())
        .post('/tools/execute')
        .send({
          toolId: createdToolId,
          parameters: {},
        })
        .expect(400);
    });
  });

  describe('Cleanup', () => {
    it('/tools/:id (DELETE) - should delete a tool', () => {
      return request(app.getHttpServer())
        .delete(`/tools/${createdToolId}`)
        .expect(204);
    });
  });
});
