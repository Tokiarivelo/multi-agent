import { Test } from '@nestjs/testing';
import { McpController, JsonRpcSuccess, JsonRpcError } from './mcp.controller';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  SearchRepositoriesTool,
  GetFileContentsTool,
  PushFilesTool,
  CreateBranchTool,
  ListIssuesTool,
  CreateIssueTool,
  ListPullRequestsTool,
  CreatePullRequestTool,
  MergePullRequestTool,
  ForkRepositoryTool,
} from '../tools';

const mockGithubApi = {
  searchRepositories: jest.fn().mockResolvedValue([{ full_name: 'org/repo' }]),
  getFileContents: jest.fn().mockResolvedValue('file content'),
  pushFiles: jest.fn().mockResolvedValue({ sha: 'abc123' }),
  createBranch: jest.fn().mockResolvedValue({ branch: 'feature/x' }),
  listIssues: jest.fn().mockResolvedValue([]),
  createIssue: jest.fn().mockResolvedValue({ number: 1 }),
  listPullRequests: jest.fn().mockResolvedValue([]),
  createPullRequest: jest.fn().mockResolvedValue({ number: 2 }),
  mergePullRequest: jest.fn().mockResolvedValue({ merged: true }),
  forkRepository: jest.fn().mockResolvedValue({ full_name: 'user/repo' }),
};

describe('McpController', () => {
  let controller: McpController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: GithubApiService, useValue: mockGithubApi },
        SearchRepositoriesTool,
        GetFileContentsTool,
        PushFilesTool,
        CreateBranchTool,
        ListIssuesTool,
        CreateIssueTool,
        ListPullRequestsTool,
        CreatePullRequestTool,
        MergePullRequestTool,
        ForkRepositoryTool,
      ],
    }).compile();

    controller = module.get(McpController);
  });

  describe('tools/list', () => {
    it('returns all registered tools', async () => {
      const res = (await controller.handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      })) as JsonRpcSuccess;
      const result = res.result as { tools: unknown[] };
      expect(result.tools).toHaveLength(10);
    });
  });

  describe('tools/call', () => {
    it('calls github_search_repositories', async () => {
      const res = (await controller.handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'github_search_repositories', arguments: { query: 'nestjs' } },
      })) as JsonRpcSuccess;
      const result = res.result as { content: Array<{ text: string }> };
      expect(result.content[0]?.text).toContain('org/repo');
    });

    it('returns METHOD_NOT_FOUND for unknown tool', async () => {
      const res = (await controller.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'unknown_tool', arguments: {} },
      })) as JsonRpcError;
      expect(res.error.code).toBe(-32601);
    });
  });

  describe('invalid requests', () => {
    it('returns INVALID_REQUEST for malformed body', async () => {
      const res = (await controller.handle(null)) as JsonRpcError;
      expect(res.error.code).toBe(-32600);
    });

    it('returns METHOD_NOT_FOUND for unknown method', async () => {
      const res = (await controller.handle({
        jsonrpc: '2.0',
        id: 4,
        method: 'unknown/method',
        params: {},
      })) as JsonRpcError;
      expect(res.error.code).toBe(-32601);
    });
  });
});
