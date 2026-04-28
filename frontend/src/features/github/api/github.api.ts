import { apiClient } from '@/lib/api-client';
import { GitHubRepo } from '@/types';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface GitHubTokenPayload {
  accessToken: string;
  login: string;
  avatarUrl: string;
}

export const githubApi = {
  /** Persist the GitHub OAuth token in the authenticated user's settings (server-side). */
  saveTokenToProfile: async (accessToken: string): Promise<void> => {
    await apiClient.patch('/api/users/me/settings', {
      settings: { githubToken: accessToken },
    });
  },

  /**
   * Fetch the authorization URL via the gateway → github-mcp-service.
   * The frontend opens this in a popup.
   */
  getAuthorizationUrl: async (): Promise<{ url: string }> => {
    const response = await fetch(`${GATEWAY_URL}/api/github/authorize`);
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<{ url: string }>;
  },

  /**
   * Exchange the OAuth code for an access token via the gateway.
   * (Called server-side in the Next.js callback API route)
   */
  exchangeCode: async (code: string): Promise<GitHubTokenPayload> => {
    const response = await fetch(
      `${GATEWAY_URL}/api/github/exchange?code=${encodeURIComponent(code)}`,
    );
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<GitHubTokenPayload>;
  },

  /**
   * List repositories for the authenticated GitHub user.
   */
  listRepositories: async (accessToken: string): Promise<GitHubRepo[]> => {
    const response = await fetch(`${GATEWAY_URL}/api/github/repositories`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(await response.text());
    const data = (await response.json()) as {
      repos: Array<{
        id: number;
        name: string;
        full_name: string;
        description: string | null;
        private: boolean;
        html_url: string;
        language: string | null;
        stargazers_count: number;
        updated_at: string;
        default_branch: string;
        fork: boolean;
      }>;
    };

    // Map snake_case from GitHub API to camelCase
    return data.repos.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      private: r.private,
      htmlUrl: r.html_url,
      language: r.language,
      stargazersCount: r.stargazers_count,
      updatedAt: r.updated_at,
      defaultBranch: r.default_branch,
      fork: r.fork,
    }));
  },

  /** Register a GitHub repo as a single multi-action MCP tool in the tool-service */
  registerRepoTool: async (repo: GitHubRepo, overrides?: { name?: string; description?: string }) => {
    const slug = repo.name.replace(/-/g, '_');
    const { data } = await apiClient.post('/api/tools', {
      name: overrides?.name ?? `github_${slug}`,
      description:
        overrides?.description ??
        `GitHub repository ${repo.fullName}. Use the 'action' parameter to choose the operation: ` +
        `'list_branches' (list all branches), ` +
        `'create_branch' (create branch, needs branch_name), ` +
        `'list_prs' (list pull requests, optional state: open|closed|all), ` +
        `'create_pr' (create PR, needs title/head/base), ` +
        `'list_files' (list directory, optional path/branch), ` +
        `'get_file' (read file content, needs path), ` +
        `'list_issues' (list issues, optional state), ` +
        `'create_issue' (create issue, needs title).`,
      category: 'MCP',
      icon: 'Github',
      repoFullName: repo.fullName,
      parameters: [
        {
          name: 'action',
          type: 'string',
          description:
            'Operation to perform: list_branches | create_branch | list_prs | create_pr | list_files | get_file | list_issues | create_issue',
          required: true,
        },
        { name: 'branch_name', type: 'string', description: 'Branch name to create (for create_branch)', required: false },
        { name: 'from_branch', type: 'string', description: 'Source branch for create_branch (defaults to main)', required: false },
        { name: 'path', type: 'string', description: 'File or directory path (for get_file / list_files)', required: false },
        { name: 'branch', type: 'string', description: 'Branch to read from (for get_file / list_files)', required: false },
        { name: 'state', type: 'string', description: 'Filter: open, closed, or all (for list_prs / list_issues)', required: false },
        { name: 'title', type: 'string', description: 'Title (for create_pr / create_issue)', required: false },
        { name: 'body', type: 'string', description: 'Body text (for create_pr / create_issue)', required: false },
        { name: 'head', type: 'string', description: 'Head branch for create_pr', required: false },
        { name: 'base', type: 'string', description: 'Base branch for create_pr', required: false },
      ],
      mcpConfig: {
        serverUrl: `${GATEWAY_URL}/api/mcp`,
        toolName: 'github_repository',
        transport: 'http',
      },
    });
    return data;
  },
};
