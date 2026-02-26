import { Test, TestingModule } from '@nestjs/testing';
import { UpdateWorkflowUseCase } from './update-workflow.use-case';
import { WORKFLOW_REPOSITORY } from '../../domain/repositories/workflow.repository.interface';
import { NotFoundException } from '@nestjs/common';
import { Workflow, WorkflowStatus, NodeType } from '../../domain/entities/workflow.entity';

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
  update: jest.fn(),
};

describe('UpdateWorkflowUseCase', () => {
  let useCase: UpdateWorkflowUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateWorkflowUseCase, { provide: WORKFLOW_REPOSITORY, useValue: mockRepo }],
    }).compile();

    useCase = module.get<UpdateWorkflowUseCase>(UpdateWorkflowUseCase);
    jest.clearAllMocks();
  });

  // ─── execute (workflow update) ──────────────────────────────────

  describe('execute', () => {
    it('should update workflow metadata', async () => {
      mockRepo.findById.mockResolvedValue(MOCK_WORKFLOW);
      const updated = { ...MOCK_WORKFLOW, name: 'Updated' };
      mockRepo.update.mockResolvedValue(updated);

      const result = await useCase.execute('wf-1', { name: 'Updated' });

      expect(mockRepo.findById).toHaveBeenCalledWith('wf-1');
      expect(mockRepo.update).toHaveBeenCalledWith(
        'wf-1',
        expect.objectContaining({ name: 'Updated' }),
      );
      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException when workflow does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(useCase.execute('missing', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ─── addNode ─────────────────────────────────────────────────────

  describe('addNode', () => {
    it('should add a node to the workflow definition', async () => {
      mockRepo.findById.mockResolvedValue(MOCK_WORKFLOW);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...MOCK_WORKFLOW, definition: data.definition }),
      );

      const result = await useCase.addNode('wf-1', {
        id: 'node-1',
        type: NodeType.AGENT,
        config: { agentId: 'agent-x' },
        position: { x: 100, y: 200 },
      });

      expect(result.definition.nodes).toHaveLength(1);
      expect(result.definition.nodes[0].id).toBe('node-1');
      expect(result.definition.nodes[0].type).toBe(NodeType.AGENT);
    });

    it('should throw NotFoundException when workflow missing', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(useCase.addNode('missing', { id: 'n1', type: NodeType.START })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateNode ──────────────────────────────────────────────────

  describe('updateNode', () => {
    const workflowWithNode = new Workflow({
      ...MOCK_WORKFLOW,
      definition: {
        nodes: [
          {
            id: 'node-1',
            type: NodeType.AGENT,
            config: { agentId: 'old' },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        version: 1,
      },
    });

    it('should update an existing node config', async () => {
      mockRepo.findById.mockResolvedValue(workflowWithNode);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...workflowWithNode, definition: data.definition }),
      );

      const result = await useCase.updateNode('wf-1', 'node-1', {
        config: { agentId: 'new-agent' },
      });

      const updated = result.definition.nodes.find((n) => n.id === 'node-1');
      expect(updated?.config.agentId).toBe('new-agent');
    });
  });

  // ─── removeNode ──────────────────────────────────────────────────

  describe('removeNode', () => {
    const workflowWithNodes = new Workflow({
      ...MOCK_WORKFLOW,
      definition: {
        nodes: [
          { id: 'node-1', type: NodeType.START, config: {}, position: { x: 0, y: 0 } },
          { id: 'node-2', type: NodeType.AGENT, config: {}, position: { x: 200, y: 0 } },
        ],
        edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
        version: 1,
      },
    });

    it('should remove node and its connected edges', async () => {
      mockRepo.findById.mockResolvedValue(workflowWithNodes);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...workflowWithNodes, definition: data.definition }),
      );

      const result = await useCase.removeNode('wf-1', 'node-1');

      expect(result.definition.nodes).toHaveLength(1);
      expect(result.definition.nodes[0].id).toBe('node-2');
      expect(result.definition.edges).toHaveLength(0); // edge was removed too
    });
  });

  // ─── addEdge ─────────────────────────────────────────────────────

  describe('addEdge', () => {
    it('should add an edge between two nodes', async () => {
      mockRepo.findById.mockResolvedValue(MOCK_WORKFLOW);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...MOCK_WORKFLOW, definition: data.definition }),
      );

      const result = await useCase.addEdge('wf-1', {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      });

      expect(result.definition.edges).toHaveLength(1);
      expect(result.definition.edges[0].source).toBe('node-1');
      expect(result.definition.edges[0].target).toBe('node-2');
    });
  });

  // ─── removeEdge ──────────────────────────────────────────────────

  describe('removeEdge', () => {
    const workflowWithEdge = new Workflow({
      ...MOCK_WORKFLOW,
      definition: {
        nodes: [],
        edges: [{ id: 'edge-1', source: 'n1', target: 'n2' }],
        version: 1,
      },
    });

    it('should remove an edge by id', async () => {
      mockRepo.findById.mockResolvedValue(workflowWithEdge);
      mockRepo.update.mockImplementation((_id, data) =>
        Promise.resolve({ ...workflowWithEdge, definition: data.definition }),
      );

      const result = await useCase.removeEdge('wf-1', 'edge-1');
      expect(result.definition.edges).toHaveLength(0);
    });
  });
});
