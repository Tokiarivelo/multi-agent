import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

@Injectable()
export class SearchRepositoriesTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_search_repositories',
      description:
        'Search GitHub repositories by keyword, language, topic, or advanced query syntax',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "GitHub search query (e.g. 'nestjs language:typescript stars:>100')",
          },
          per_page: { type: 'number', description: 'Results per page (max 30)', default: 10 },
        },
        required: ['query'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const results = await this.github.searchRepositories(
      args['query'] as string,
      (args['per_page'] as number | undefined) ?? 10,
    );
    return textResult(results);
  }
}
