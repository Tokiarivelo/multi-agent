import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class CreateBranchTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_create_branch',
      description: 'Create a new branch from an existing branch',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          branch: { type: 'string', description: 'New branch name' },
          from_branch: {
            type: 'string',
            description: 'Source branch (default: main)',
            default: 'main',
          },
        },
        required: ['owner', 'repo', 'branch'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.github.createBranch(
      args['owner'] as string,
      args['repo'] as string,
      args['branch'] as string,
      (args['from_branch'] as string | undefined) ?? 'main',
    );
    return textResult(result);
  }
}
