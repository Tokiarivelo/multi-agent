import { apiClient } from '@/lib/api-client';
import { GitHubRepo } from '@/types';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface GitHubTokenPayload {
  accessToken: string;
  login: string;
  avatarUrl: string;
}

export const githubApi = {
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

  /** Register a GitHub repo as an MCP tool in the tool-service */
  registerRepoTool: async (repo: GitHubRepo, overrides?: { name?: string; description?: string }) => {
    const { data } = await apiClient.post('/api/tools', {
      name: overrides?.name ?? `github_${repo.name.replace(/-/g, '_')}`,
      description: overrides?.description ?? (repo.description ?? `GitHub repository: ${repo.fullName}`),
      category: 'MCP',
      icon: 'Github',
      repoFullName: repo.fullName,
      parameters: [
        { name: 'path', type: 'string', description: 'File or directory path', required: false },
        { name: 'branch', type: 'string', description: 'Branch name', required: false },
      ],
      mcpConfig: {
        serverUrl: `${GATEWAY_URL}/api/mcp`,
        toolName: 'github_get_file_contents',
        transport: 'http',
      },
    });
    return data;
  },
};
