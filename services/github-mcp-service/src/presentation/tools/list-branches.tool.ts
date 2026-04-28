import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class ListBranchesTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_list_branches',
      description: 'List all branches in a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const branches = await this.github.listBranches(
      args['owner'] as string,
      args['repo'] as string,
    );
    return textResult(JSON.stringify(branches, null, 2));
  }
}
