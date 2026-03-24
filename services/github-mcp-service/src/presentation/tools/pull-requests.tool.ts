import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class ListPullRequestsTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_list_pull_requests',
      description: 'List pull requests for a repository',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: {
            type: 'string',
            description: 'PR state',
            enum: ['open', 'closed', 'all'],
            default: 'open',
          },
          base: { type: 'string', description: 'Filter by base branch name' },
        },
        required: ['owner', 'repo'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const results = await this.github.listPullRequests(
      args['owner'] as string,
      args['repo'] as string,
      (args['state'] as 'open' | 'closed' | 'all' | undefined) ?? 'open',
      args['base'] as string | undefined,
    );
    return textResult(results);
  }
}

@Injectable()
export class CreatePullRequestTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_create_pull_request',
      description: 'Open a pull request',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'PR title' },
          body: { type: 'string', description: 'PR description (markdown)' },
          head: { type: 'string', description: 'Branch containing the changes' },
          base: { type: 'string', description: 'Branch to merge into' },
        },
        required: ['owner', 'repo', 'title', 'body', 'head', 'base'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.github.createPullRequest(
      args['owner'] as string,
      args['repo'] as string,
      args['title'] as string,
      args['body'] as string,
      args['head'] as string,
      args['base'] as string,
    );
    return textResult(result);
  }
}

@Injectable()
export class MergePullRequestTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_merge_pull_request',
      description: 'Merge a pull request',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          pull_number: { type: 'number', description: 'PR number' },
          merge_method: {
            type: 'string',
            description: 'Merge strategy',
            enum: ['merge', 'squash', 'rebase'],
            default: 'squash',
          },
        },
        required: ['owner', 'repo', 'pull_number'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.github.mergePullRequest(
      args['owner'] as string,
      args['repo'] as string,
      args['pull_number'] as number,
      (args['merge_method'] as 'merge' | 'squash' | 'rebase' | undefined) ?? 'squash',
    );
    return textResult(result);
  }
}

@Injectable()
export class ForkRepositoryTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_fork_repository',
      description: 'Fork a repository to a user account or organization',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          organization: {
            type: 'string',
            description: 'Target organization (defaults to authenticated user)',
          },
        },
        required: ['owner', 'repo'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const result = await this.github.forkRepository(
      args['owner'] as string,
      args['repo'] as string,
      args['organization'] as string | undefined,
    );
    return textResult(result);
  }
}
