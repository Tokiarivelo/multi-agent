import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GmailTriggerService } from './gmail-trigger.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const mockPrisma = {
  gmailWatchSubscription: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

const baseRow = {
  id: 'sub-1',
  workflowId: 'wf-1',
  userId: 'user-1',
  gmailUser: 'alice@gmail.com',
  topicName: 'projects/my-project/topics/gmail-push',
  labelIds: ['INBOX'],
  historyId: '123',
  expiration: '1234567890000',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GmailTriggerService', () => {
  let service: GmailTriggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GmailTriggerService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<GmailTriggerService>(GmailTriggerService);
    jest.clearAllMocks();
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('should upsert a subscription and return it', async () => {
      mockPrisma.gmailWatchSubscription.upsert.mockResolvedValue(baseRow);

      const result = await service.register({
        workflowId: 'wf-1',
        userId: 'user-1',
        gmailUser: 'alice@gmail.com',
        topicName: 'projects/my-project/topics/gmail-push',
        labelIds: ['INBOX'],
        historyId: '123',
        expiration: '1234567890000',
      });

      expect(mockPrisma.gmailWatchSubscription.upsert).toHaveBeenCalledTimes(1);
      expect(result.gmailUser).toBe('alice@gmail.com');
      expect(result.isActive).toBe(true);
    });

    it('should default labelIds to ["INBOX"] when not provided', async () => {
      mockPrisma.gmailWatchSubscription.upsert.mockResolvedValue({
        ...baseRow,
        labelIds: ['INBOX'],
      });

      await service.register({
        workflowId: 'wf-1',
        userId: 'user-1',
        gmailUser: 'alice@gmail.com',
        topicName: 'projects/my-project/topics/gmail-push',
      });

      const upsertCall = mockPrisma.gmailWatchSubscription.upsert.mock.calls[0][0] as {
        create: { labelIds: string[] };
      };
      expect(upsertCall.create.labelIds).toEqual(['INBOX']);
    });
  });

  // ─── unregister ───────────────────────────────────────────────────────────

  describe('unregister', () => {
    it('should set isActive=false on an existing subscription', async () => {
      mockPrisma.gmailWatchSubscription.findUnique.mockResolvedValue(baseRow);
      mockPrisma.gmailWatchSubscription.update.mockResolvedValue({
        ...baseRow,
        isActive: false,
      });

      await service.unregister('wf-1', 'alice@gmail.com');

      expect(mockPrisma.gmailWatchSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException when subscription does not exist', async () => {
      mockPrisma.gmailWatchSubscription.findUnique.mockResolvedValue(null);

      await expect(service.unregister('wf-1', 'alice@gmail.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── findActiveByGmailUser ────────────────────────────────────────────────

  describe('findActiveByGmailUser', () => {
    it('should return all active subscriptions for a gmail user', async () => {
      mockPrisma.gmailWatchSubscription.findMany.mockResolvedValue([baseRow]);

      const result = await service.findActiveByGmailUser('alice@gmail.com');

      expect(mockPrisma.gmailWatchSubscription.findMany).toHaveBeenCalledWith({
        where: { gmailUser: 'alice@gmail.com', isActive: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].workflowId).toBe('wf-1');
    });

    it('should return empty array when no subscriptions exist', async () => {
      mockPrisma.gmailWatchSubscription.findMany.mockResolvedValue([]);

      const result = await service.findActiveByGmailUser('nobody@gmail.com');
      expect(result).toEqual([]);
    });
  });

  // ─── updateHistoryId ──────────────────────────────────────────────────────

  describe('updateHistoryId', () => {
    it('should update the historyId on a subscription', async () => {
      mockPrisma.gmailWatchSubscription.update.mockResolvedValue({
        ...baseRow,
        historyId: '999',
      });

      await service.updateHistoryId('sub-1', '999');

      expect(mockPrisma.gmailWatchSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { historyId: '999' },
      });
    });
  });
});
