import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetMarketplaceTemplateUseCase } from './get-marketplace-template.use-case';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const MOCK_TEMPLATE_DETAIL = {
  id: 'tpl-1',
  name: 'Email Digest',
  description: 'Daily digest',
  category: 'Automation',
  tags: ['email'],
  installsCount: 5,
  previewImageUrl: null,
  isFeatured: true,
  authorName: 'Multi-Agent Team',
  nodes: [{ id: 'start', type: 'START', config: {} }],
  edges: [],
  definition: { nodes: [], edges: [], version: 1 },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  workflow: {
    findFirst: jest.fn(),
  },
};

describe('GetMarketplaceTemplateUseCase', () => {
  let useCase: GetMarketplaceTemplateUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMarketplaceTemplateUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<GetMarketplaceTemplateUseCase>(GetMarketplaceTemplateUseCase);
    jest.clearAllMocks();
  });

  it('returns full template detail including nodes and edges', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(MOCK_TEMPLATE_DETAIL);

    const result = await useCase.execute('tpl-1');

    expect(result).toEqual(MOCK_TEMPLATE_DETAIL);
    expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tpl-1', isTemplate: true, visibility: 'PUBLIC' },
      }),
    );
  });

  it('throws NotFoundException when template does not exist', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when workflow is not a template', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    await expect(useCase.execute('regular-workflow-id')).rejects.toThrow(NotFoundException);
    expect(mockPrisma.workflow.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isTemplate: true }),
      }),
    );
  });
});
