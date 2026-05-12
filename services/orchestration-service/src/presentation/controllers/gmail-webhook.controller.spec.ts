import { Test, TestingModule } from '@nestjs/testing';
import { GmailWebhookController } from './gmail-webhook.controller';
import { GmailTriggerService } from '../../domain/services/gmail-trigger.service';
import { ExecuteWorkflowUseCase } from '../../application/use-cases/execute-workflow.use-case';

const mockTriggerService = {
  findActiveByGmailUser: jest.fn(),
  register: jest.fn(),
  unregister: jest.fn(),
  findByWorkflow: jest.fn(),
  updateHistoryId: jest.fn(),
};

const mockExecuteWorkflowUseCase = {
  execute: jest.fn().mockResolvedValue({ id: 'exec-1' }),
};

const validPayload = {
  emailAddress: 'alice@gmail.com',
  historyId: 99999,
};

function encodePubSubData(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

const baseSub = {
  id: 'sub-1',
  workflowId: 'wf-1',
  userId: 'user-1',
  gmailUser: 'alice@gmail.com',
  topicName: 'projects/p/topics/t',
  labelIds: ['INBOX'],
  historyId: '12345',
  expiration: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GmailWebhookController', () => {
  let controller: GmailWebhookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailWebhookController],
      providers: [
        { provide: GmailTriggerService, useValue: mockTriggerService },
        { provide: ExecuteWorkflowUseCase, useValue: mockExecuteWorkflowUseCase },
      ],
    }).compile();

    controller = module.get<GmailWebhookController>(GmailWebhookController);
    jest.clearAllMocks();
  });

  // ─── handlePush ───────────────────────────────────────────────────────────

  describe('handlePush', () => {
    it('should fire the workflow for a matching active subscription', async () => {
      mockTriggerService.findActiveByGmailUser.mockResolvedValue([baseSub]);
      mockExecuteWorkflowUseCase.execute.mockResolvedValue({ id: 'exec-1' });
      mockTriggerService.updateHistoryId.mockResolvedValue(undefined);

      await controller.handlePush({
        message: { data: encodePubSubData(validPayload) },
      });

      expect(mockTriggerService.findActiveByGmailUser).toHaveBeenCalledWith('alice@gmail.com');
      // Execution is fire-and-forget — allow microtask queue to flush
      await Promise.resolve();
      await Promise.resolve();
      expect(mockExecuteWorkflowUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'wf-1' }),
        'user-1',
      );
    });

    it('should silently return (204) when no subscriptions exist', async () => {
      mockTriggerService.findActiveByGmailUser.mockResolvedValue([]);

      await expect(
        controller.handlePush({
          message: { data: encodePubSubData(validPayload) },
        }),
      ).resolves.toBeUndefined();

      expect(mockExecuteWorkflowUseCase.execute).not.toHaveBeenCalled();
    });

    it('should not throw on malformed base64 payload', async () => {
      await expect(
        controller.handlePush({
          message: { data: '!!!not-base64!!!' },
        }),
      ).resolves.toBeUndefined();

      expect(mockTriggerService.findActiveByGmailUser).not.toHaveBeenCalled();
    });

    it('should not throw when DB lookup fails', async () => {
      mockTriggerService.findActiveByGmailUser.mockRejectedValue(new Error('DB down'));

      await expect(
        controller.handlePush({
          message: { data: encodePubSubData(validPayload) },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should delegate to GmailTriggerService.register', async () => {
      mockTriggerService.register.mockResolvedValue(baseSub);

      const result = await controller.register({
        workflowId: 'wf-1',
        userId: 'user-1',
        gmailUser: 'alice@gmail.com',
        topicName: 'projects/p/topics/t',
      });

      expect(mockTriggerService.register).toHaveBeenCalledTimes(1);
      expect(result.gmailUser).toBe('alice@gmail.com');
    });
  });

  // ─── unregister ───────────────────────────────────────────────────────────

  describe('unregister', () => {
    it('should delegate to GmailTriggerService.unregister', async () => {
      mockTriggerService.unregister.mockResolvedValue(undefined);

      await controller.unregister({ workflowId: 'wf-1', gmailUser: 'alice@gmail.com' });

      expect(mockTriggerService.unregister).toHaveBeenCalledWith('wf-1', 'alice@gmail.com');
    });
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return subscriptions for a workflow', async () => {
      mockTriggerService.findByWorkflow.mockResolvedValue([baseSub]);

      const result = await controller.list('wf-1');
      expect(result).toHaveLength(1);
    });
  });
});
