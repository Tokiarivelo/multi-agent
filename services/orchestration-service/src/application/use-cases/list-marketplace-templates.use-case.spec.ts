import { Test, TestingModule } from '@nestjs/testing';
import {
  ListMarketplaceTemplatesUseCase,
  TemplateListItem,
} from './list-marketplace-templates.use-case';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const MOCK_TEMPLATE: TemplateListItem = {
  id: 'tpl-1',
  name: 'Email Digest',
  description: 'Daily email digest',
  category: 'Automation',
  tags: ['email', 'daily'],
  installsCount: 42,
  previewImageUrl: null,
  isFeatured: true,
  authorName: 'Multi-Agent Team',
  userId: '00000000-0000-0000-0000-000000000001',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  workflow: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('ListMarketplaceTemplatesUseCase', () => {
  let useCase: ListMarketplaceTemplatesUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListMarketplaceTemplatesUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<ListMarketplaceTemplatesUseCase>(ListMarketplaceTemplatesUseCase);
    jest.clearAllMocks();
  });

  it('returns paginated templates with no filters', async () => {
    mockPrisma.workflow.count.mockResolvedValue(1);
    mockPrisma.workflow.findMany.mockResolvedValue([MOCK_TEMPLATE]);

    const result = await useCase.execute({ page: 1, limit: 12 });

    expect(result).toEqual({ data: [MOCK_TEMPLATE], total: 1, page: 1, limit: 12 });
    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isTemplate: true, visibility: 'PUBLIC' }, skip: 0, take: 12 }),
    );
  });

  it('filters by category', async () => {
    mockPrisma.workflow.count.mockResolvedValue(1);
    mockPrisma.workflow.findMany.mockResolvedValue([MOCK_TEMPLATE]);

    await useCase.execute({ category: 'Automation', page: 1, limit: 12 });

    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ category: 'Automation' }) }),
    );
  });

  it('adds search OR clause when search is provided', async () => {
    mockPrisma.workflow.count.mockResolvedValue(0);
    mockPrisma.workflow.findMany.mockResolvedValue([]);

    await useCase.execute({ search: 'email', page: 1, limit: 12 });

    const callArgs = mockPrisma.workflow.findMany.mock.calls[0]![0] as any;
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR[0].name.contains).toBe('email');
  });

  it('calculates correct skip for page 2', async () => {
    mockPrisma.workflow.count.mockResolvedValue(20);
    mockPrisma.workflow.findMany.mockResolvedValue([]);

    await useCase.execute({ page: 2, limit: 12 });

    expect(mockPrisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 12 }),
    );
  });

  it('getCategories returns distinct non-null categories', async () => {
    mockPrisma.workflow.groupBy.mockResolvedValue([
      { category: 'AI' },
      { category: 'Automation' },
      { category: null },
    ]);

    const result = await useCase.getCategories();

    expect(result).toEqual(['AI', 'Automation']);
  });
});
