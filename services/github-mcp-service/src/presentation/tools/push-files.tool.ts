import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class PushFilesTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_push_files',
      description: 'Create or update one or more files in a single commit',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          branch: { type: 'string', description: 'Target branch' },
          files: { type: 'array', description: 'Array of {path, content} objects' },
          message: { type: 'string', description: 'Commit message' },
        },
        required: ['owner', 'repo', 'branch', 'files', 'message'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.github.pushFiles(
      args['owner'] as string,
      args['repo'] as string,
      args['branch'] as string,
      args['files'] as Array<{ path: string; content: string }>,
      args['message'] as string,
    );
    return textResult(result);
  }
}
