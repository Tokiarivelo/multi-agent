import { Controller, Post, Body, HttpCode, Get, Logger, Headers } from '@nestjs/common';
import { McpToolHandler, McpToolResult } from '@domain/github-tool.interface';
import {
  SearchRepositoriesTool,
  GetFileContentsTool,
  ListBranchesTool,
  RepositoryTool,
  PushFilesTool,
  CreateBranchTool,
  ListIssuesTool,
  CreateIssueTool,
  ListPullRequestsTool,
  CreatePullRequestTool,
  MergePullRequestTool,
  ForkRepositoryTool,
} from '../tools';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number | string;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: number | string | null;
  error: { code: number; message: string; data?: unknown };
}

const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);
  private readonly tools: Map<string, McpToolHandler>;

  constructor(
    searchRepos: SearchRepositoriesTool,
    getFile: GetFileContentsTool,
    listBranches: ListBranchesTool,
    repository: RepositoryTool,
    pushFiles: PushFilesTool,
    createBranch: CreateBranchTool,
    listIssues: ListIssuesTool,
    createIssue: CreateIssueTool,
    listPRs: ListPullRequestsTool,
    createPR: CreatePullRequestTool,
    mergePR: MergePullRequestTool,
    forkRepo: ForkRepositoryTool,
  ) {
    const handlers: McpToolHandler[] = [
      searchRepos,
      getFile,
      listBranches,
      repository,
      pushFiles,
      createBranch,
      listIssues,
      createIssue,
      listPRs,
      createPR,
      mergePR,
      forkRepo,
    ];

    this.tools = new Map(handlers.map((h) => [h.schema().name, h]));
  }

  @Get('health')
  health() {
    return { status: 'ok', tools: this.tools.size };
  }

  @Post()
  @HttpCode(200)
  async handle(
    @Body() body: unknown,
    @Headers('x-github-token') githubToken?: string,
  ): Promise<JsonRpcSuccess | JsonRpcError> {
    const req = body as JsonRpcRequest;

    if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || !req.method) {
      return this.error(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid JSON-RPC request');
    }

    this.logger.debug(`RPC method="${req.method}" id=${req.id} oauth=${githubToken ? 'yes' : 'no'}`);

    try {
      switch (req.method) {
        case 'tools/list':
          return this.success(req.id, { tools: [...this.tools.values()].map((t) => t.schema()) });

        case 'tools/call': {
          const { name, arguments: args } = req.params as {
            name: string;
            arguments: Record<string, unknown>;
          };
          const tool = this.tools.get(name);

          if (!tool) {
            return this.error(req.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
          }

          // Inject the OAuth token so the tool executes as the user, not the GitHub App
          const argsWithToken = githubToken
            ? { ...args, __githubToken: githubToken }
            : args;

          const result: McpToolResult = await tool.execute(argsWithToken ?? {});
          return this.success(req.id, result);
        }

        default:
          return this.error(
            req.id,
            JSON_RPC_ERRORS.METHOD_NOT_FOUND,
            `Unknown method: ${req.method}`,
          );
      }
    } catch (err: unknown) {
      let message: string;
      if (err instanceof Error) {
        const httpStatus = (err as any).status as number | undefined;
        const base = err.message || 'Unknown error';
        message = httpStatus ? `${base} [HTTP ${httpStatus}]` : base;
      } else {
        message = String(err) || 'Internal error';
      }
      this.logger.error(`RPC error: ${message}`);
      return this.error(req.id, JSON_RPC_ERRORS.INTERNAL_ERROR, message);
    }
  }

  private success(id: number | string, result: unknown): JsonRpcSuccess {
    return { jsonrpc: '2.0', id, result };
  }

  private error(id: number | string | null, code: number, message: string): JsonRpcError {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}
