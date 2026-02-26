import { Test, TestingModule } from '@nestjs/testing';
import { DeleteWorkflowUseCase } from './delete-workflow.use-case';
import { WORKFLOW_REPOSITORY } from '../../domain/repositories/workflow.repository.interface';
import { NotFoundException } from '@nestjs/common';
import { Workflow, WorkflowStatus } from '../../domain/entities/workflow.entity';

const MOCK_WORKFLOW = new Workflow({
  id: 'wf-1',
  name: 'Test Workflow',
  description: 'desc',
  status: WorkflowStatus.DRAFT,
  userId: 'user-1',
  definition: { nodes: [], edges: [], version: 1 },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockRepo = {
  findById: jest.fn(),
  delete: jest.fn(),
};

describe('DeleteWorkflowUseCase', () => {
  let useCase: DeleteWorkflowUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeleteWorkflowUseCase, { provide: WORKFLOW_REPOSITORY, useValue: mockRepo }],
    }).compile();

    useCase = module.get<DeleteWorkflowUseCase>(DeleteWorkflowUseCase);
    jest.clearAllMocks();
  });

  it('should delete an existing workflow', async () => {
    mockRepo.findById.mockResolvedValue(MOCK_WORKFLOW);
    mockRepo.delete.mockResolvedValue(undefined);

    await expect(useCase.execute('wf-1')).resolves.toBeUndefined();
    expect(mockRepo.findById).toHaveBeenCalledWith('wf-1');
    expect(mockRepo.delete).toHaveBeenCalledWith('wf-1');
  });

  it('should throw NotFoundException when workflow does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
