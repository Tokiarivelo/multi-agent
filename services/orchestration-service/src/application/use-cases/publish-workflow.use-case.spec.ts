import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PublishWorkflowUseCase } from './publish-workflow.use-case';

const mockWorkflow = {
  id: 'wf-1',
  name: 'My Workflow',
  userId: 'user-1',
  isTemplate: false,
};

const mockUser = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@example.com',
  role: 'USER',
};

const mockPrisma = {
  workflow: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('PublishWorkflowUseCase', () => {
  let useCase: PublishWorkflowUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new PublishWorkflowUseCase(mockPrisma as never);
  });

  // ─── publish ──────────────────────────────────────────────────────────────

  describe('publish', () => {
    it('publishes workflow and sets isTemplate + visibility', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'My Workflow',
        category: 'AI',
        authorName: 'Alice Smith',
        isTemplate: true,
      });

      const result = await useCase.publish({
        workflowId: 'wf-1',
        userId: 'user-1',
        description: 'Does cool things',
        category: 'AI',
        tags: ['ai', 'automation'],
      });

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isTemplate: true,
            visibility: 'PUBLIC',
            authorName: 'Alice Smith',
            isFeatured: false,
          }),
        }),
      );
      expect(result.isTemplate).toBe(true);
    });

    it('builds authorName from firstName + lastName', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'x',
        category: 'AI',
        authorName: 'Alice Smith',
        isTemplate: true,
      });

      await useCase.publish({
        workflowId: 'wf-1',
        userId: 'user-1',
        description: 'desc',
        category: 'AI',
      });

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ authorName: 'Alice Smith' }) }),
      );
    });

    it('falls back to email when name is blank', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, firstName: '', lastName: '' });
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'x',
        category: 'AI',
        authorName: 'alice@example.com',
        isTemplate: true,
      });

      await useCase.publish({
        workflowId: 'wf-1',
        userId: 'user-1',
        description: 'desc',
        category: 'AI',
      });

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ authorName: 'alice@example.com' }),
        }),
      );
    });

    it('allows admin to set isFeatured', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, role: 'ADMIN' });
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'x',
        category: 'AI',
        authorName: 'Alice Smith',
        isTemplate: true,
      });

      await useCase.publish({
        workflowId: 'wf-1',
        userId: 'user-1',
        description: 'desc',
        category: 'AI',
        isFeatured: true,
      });

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isFeatured: true }) }),
      );
    });

    it('ignores isFeatured for non-admin users', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'x',
        category: 'AI',
        authorName: 'Alice Smith',
        isTemplate: true,
      });

      await useCase.publish({
        workflowId: 'wf-1',
        userId: 'user-1',
        description: 'desc',
        category: 'AI',
        isFeatured: true,
      });

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isFeatured: false }) }),
      );
    });

    it('throws ForbiddenException when workflow was installed from the marketplace', async () => {
      mockPrisma.workflow.findUnique
        .mockResolvedValueOnce({ ...mockWorkflow, forkedFromId: 'template-1' })
        .mockResolvedValueOnce({ isTemplate: true });

      await expect(
        useCase.publish({ workflowId: 'wf-1', userId: 'user-1', description: 'x', category: 'AI' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows publishing a fork of a regular (non-template) workflow', async () => {
      mockPrisma.workflow.findUnique
        .mockResolvedValueOnce({ ...mockWorkflow, forkedFromId: 'regular-wf' })
        .mockResolvedValueOnce({ isTemplate: false });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'x',
        category: 'AI',
        authorName: 'Alice Smith',
        isTemplate: true,
      });

      await expect(
        useCase.publish({ workflowId: 'wf-1', userId: 'user-1', description: 'x', category: 'AI' }),
      ).resolves.toBeDefined();
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(null);

      await expect(
        useCase.publish({
          workflowId: 'no-such',
          userId: 'user-1',
          description: 'x',
          category: 'AI',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({ ...mockWorkflow, userId: 'other-user' });

      await expect(
        useCase.publish({ workflowId: 'wf-1', userId: 'user-1', description: 'x', category: 'AI' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when workflow is already published', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({ ...mockWorkflow, isTemplate: true });

      await expect(
        useCase.publish({ workflowId: 'wf-1', userId: 'user-1', description: 'x', category: 'AI' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── unpublish ────────────────────────────────────────────────────────────

  describe('unpublish', () => {
    const publishedWorkflow = { ...mockWorkflow, isTemplate: true };

    it('sets isTemplate false and visibility PRIVATE', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(publishedWorkflow);
      mockPrisma.workflow.update.mockResolvedValue({});

      await useCase.unpublish('wf-1', 'user-1');

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isTemplate: false, visibility: 'PRIVATE', isFeatured: false },
        }),
      );
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({ ...publishedWorkflow, userId: 'other' });

      await expect(useCase.unpublish('wf-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when workflow is not published', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      await expect(useCase.unpublish('wf-1', 'user-1')).rejects.toThrow(ConflictException);
    });
  });

  // ─── updatePublished ──────────────────────────────────────────────────────

  describe('updatePublished', () => {
    const publishedWorkflow = { ...mockWorkflow, isTemplate: true };

    it('updates metadata fields', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(publishedWorkflow);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.workflow.update.mockResolvedValue({
        id: 'wf-1',
        name: 'Updated',
        category: 'Data',
        authorName: 'Alice Smith',
        isTemplate: true,
      });

      const result = await useCase.updatePublished('wf-1', 'user-1', {
        name: 'Updated',
        category: 'Data',
        tags: ['data', 'etl'],
      });

      expect(mockPrisma.workflow.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated',
            category: 'Data',
            tags: ['data', 'etl'],
          }),
        }),
      );
      expect(result.name).toBe('Updated');
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue({ ...publishedWorkflow, userId: 'other' });

      await expect(useCase.updatePublished('wf-1', 'user-1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when workflow is not published', async () => {
      mockPrisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      await expect(useCase.updatePublished('wf-1', 'user-1', {})).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
