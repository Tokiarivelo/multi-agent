import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class ListIssuesTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_list_issues',
      description: 'List issues for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: {
            type: 'string',
            description: 'Issue state',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          labels: { type: 'string', description: 'Comma-separated label names to filter by' },
        },
        required: ['owner', 'repo'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const results = await this.github.listIssues(
      args['owner'] as string,
      args['repo'] as string,
      (args['state'] as 'open' | 'closed' | 'all' | undefined) ?? 'open',
      args['labels'] as string | undefined,
    );
    return textResult(results);
  }
}

@Injectable()
export class CreateIssueTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_create_issue',
      description: 'Create a new issue in a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'Issue title' },
          body: { type: 'string', description: 'Issue body (markdown)' },
          labels: { type: 'array', description: 'Label names to apply' },
        },
        required: ['owner', 'repo', 'title'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.github.createIssue(
      args['owner'] as string,
      args['repo'] as string,
      args['title'] as string,
      args['body'] as string | undefined,
      args['labels'] as string[] | undefined,
    );
    return textResult(result);
  }
}
