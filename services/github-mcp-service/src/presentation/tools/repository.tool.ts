import { Injectable } from '@nestjs/common';
import { GithubApiService } from '@infrastructure/github/github-api.service';
import {
  McpToolHandler,
  McpToolSchema,
  McpToolResult,
  textResult,
} from '@domain/github-tool.interface';

type Action =
  | 'list_branches'
  | 'create_branch'
  | 'list_prs'
  | 'create_pr'
  | 'merge_pr'
  | 'list_files'
  | 'get_file'
  | 'list_issues'
  | 'create_issue';

@Injectable()
export class RepositoryTool implements McpToolHandler {
  constructor(private readonly github: GithubApiService) {}

  schema(): McpToolSchema {
    return {
      name: 'github_repository',
      description:
        'Perform GitHub operations on a repository. Use the action parameter to choose the operation. ' +
        'Available actions: ' +
        '"list_branches" — list all branches; ' +
        '"create_branch" — create a new branch (requires branch_name, optional from_branch); ' +
        '"list_prs" — list pull requests (optional state: open|closed|all); ' +
        '"create_pr" — create a pull request (requires title, head, base, optional body); ' +
        '"merge_pr" — merge a pull request (requires pull_number, optional merge_method: merge|squash|rebase, defaults to squash); ' +
        '"list_files" — list files/directories (optional path, optional branch); ' +
        '"get_file" — read a file (requires path, optional branch); ' +
        '"list_issues" — list issues (optional state: open|closed|all); ' +
        '"create_issue" — create an issue (requires title, optional body).',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
          action: {
            type: 'string',
            description:
              'Operation to perform. One of: list_branches, create_branch, list_prs, create_pr, merge_pr, list_files, get_file, list_issues, create_issue',
            enum: [
              'list_branches',
              'create_branch',
              'list_prs',
              'create_pr',
              'merge_pr',
              'list_files',
              'get_file',
              'list_issues',
              'create_issue',
            ],
          },
          branch_name: { type: 'string', description: 'Branch name to create (for create_branch)' },
          from_branch: {
            type: 'string',
            description: 'Source branch for create_branch (defaults to main)',
          },
          path: { type: 'string', description: 'File or directory path (for get_file / list_files)' },
          branch: { type: 'string', description: 'Branch to read from (for get_file / list_files)' },
          state: {
            type: 'string',
            description: 'Filter state for list_prs / list_issues: open, closed, or all',
          },
          title: { type: 'string', description: 'Title (for create_pr / create_issue)' },
          body: { type: 'string', description: 'Body text (for create_pr / create_issue)' },
          head: { type: 'string', description: 'Head branch for create_pr' },
          base: { type: 'string', description: 'Base branch for create_pr' },
          pull_number: { type: 'number', description: 'PR number to merge (for merge_pr)' },
          merge_method: {
            type: 'string',
            description: 'Merge strategy for merge_pr: merge, squash, or rebase (defaults to squash)',
            enum: ['merge', 'squash', 'rebase'],
          },
        },
        required: ['owner', 'repo', 'action'],
      },
    };
  }

  async execute(args: Record<string, unknown>): Promise<McpToolResult> {
    const owner = args['owner'] as string;
    const repo = args['repo'] as string;
    const action = args['action'] as Action;
    // Injected by the MCP controller from the x-github-token header
    const oauthToken = args['__githubToken'] as string | undefined;
    const gh = await this.github.octokitFor(oauthToken);

    switch (action) {
      case 'list_branches': {
        const data = await this.github.listBranches(owner, repo, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'create_branch': {
        const branchName = args['branch_name'] as string;
        const fromBranch = (args['from_branch'] as string | undefined) ?? 'main';
        if (!branchName) throw new Error('branch_name is required for create_branch');
        const data = await this.github.createBranch(owner, repo, branchName, fromBranch, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'list_prs': {
        const state = ((args['state'] as string) || 'open') as 'open' | 'closed' | 'all';
        const base = args['base'] as string | undefined;
        const data = await this.github.listPullRequests(owner, repo, state, base, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'create_pr': {
        const title = args['title'] as string;
        const head = args['head'] as string;
        const base = args['base'] as string;
        const body = (args['body'] as string) || '';
        if (!title || !head || !base) throw new Error('title, head, and base are required for create_pr');
        const data = await this.github.createPullRequest(owner, repo, title, body, head, base, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'merge_pr': {
        const pullNumber = args['pull_number'] as number;
        if (!pullNumber) throw new Error('pull_number is required for merge_pr');
        const mergeMethod = ((args['merge_method'] as string) || 'squash') as 'merge' | 'squash' | 'rebase';
        const data = await this.github.mergePullRequest(owner, repo, pullNumber, mergeMethod, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'list_files': {
        const path = (args['path'] as string) || '/';
        const branch = args['branch'] as string | undefined;
        const data = await this.github.getFileContents(owner, repo, path, branch, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'get_file': {
        const path = args['path'] as string;
        const branch = args['branch'] as string | undefined;
        if (!path) throw new Error('path is required for get_file');
        const data = await this.github.getFileContents(owner, repo, path, branch, gh);
        return textResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      }

      case 'list_issues': {
        const state = ((args['state'] as string) || 'open') as 'open' | 'closed' | 'all';
        const data = await this.github.listIssues(owner, repo, state, undefined, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      case 'create_issue': {
        const title = args['title'] as string;
        const body = args['body'] as string | undefined;
        if (!title) throw new Error('title is required for create_issue');
        const data = await this.github.createIssue(owner, repo, title, body, undefined, gh);
        return textResult(JSON.stringify(data, null, 2));
      }

      default:
        throw new Error(
          `Unknown action "${action}". Valid actions: list_branches, create_branch, list_prs, create_pr, merge_pr, list_files, get_file, list_issues, create_issue`,
        );
    }
  }
}
