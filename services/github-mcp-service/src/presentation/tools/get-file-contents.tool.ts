import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class GetFileContentsTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_get_file_contents',
      description: 'Read a file or list a directory from a GitHub repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
          path: { type: 'string', description: 'File or directory path' },
          branch: { type: 'string', description: 'Branch name (defaults to default branch)' },
        },
        required: ['owner', 'repo', 'path'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const data = await this.github.getFileContents(
      args['owner'] as string,
      args['repo'] as string,
      args['path'] as string,
      args['branch'] as string | undefined,
    );
    return textResult(data);
  }
}
