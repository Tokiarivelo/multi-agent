import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InstallTemplateUseCase } from './install-template.use-case';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const MOCK_TEMPLATE = {
  id: 'tpl-1',
  name: 'Email Digest',
  description: 'Daily digest',
  nodes: [{ id: 'start', type: 'START', config: {} }],
  edges: [],
  definition: { nodes: [], edges: [], version: 1 },
  isTemplate: true,
  visibility: 'PUBLIC',
  userId: 'system-user',
};

const MOCK_NEW_WORKFLOW = {
  id: 'wf-new-1',
  name: 'Email Digest',
  forkedFromId: 'tpl-1',
};

const mockPrisma = {
  workflow: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('InstallTemplateUseCase', () => {
  let useCase: InstallTemplateUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallTemplateUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<InstallTemplateUseCase>(InstallTemplateUseCase);
    jest.clearAllMocks();
  });

  it('creates fork of template and returns new workflow', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(MOCK_TEMPLATE);
    mockPrisma.$transaction.mockResolvedValue([MOCK_NEW_WORKFLOW, { id: 'tpl-1' }]);

    const result = await useCase.execute('tpl-1', 'user-123');

    expect(result).toEqual(MOCK_NEW_WORKFLOW);
    expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tpl-1', isTemplate: true, visibility: 'PUBLIC' } }),
    );
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('includes forkedFromId pointing to the template', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(MOCK_TEMPLATE);
    mockPrisma.$transaction.mockResolvedValue([MOCK_NEW_WORKFLOW, { id: 'tpl-1' }]);

    const result = await useCase.execute('tpl-1', 'user-123');

    expect(result.forkedFromId).toBe('tpl-1');
  });

  it('throws NotFoundException when template does not exist', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('missing', 'user-123')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when workflow is not a template', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('regular-wf', 'user-123')).rejects.toThrow(NotFoundException);
  });
});
