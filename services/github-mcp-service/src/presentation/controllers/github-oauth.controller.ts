import {
  Controller,
  Get,
  Query,
  Headers,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface GitHubUserRepo {
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
}

@Controller('github')
export class GithubOauthController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns the GitHub OAuth authorization URL.
   * The frontend opens this URL in a popup window.
   */
  @Get('authorize')
  getAuthorizationUrl(): { url: string } {
    const clientId = this.configService.get<string>('githubOAuth.clientId');
    const callbackUrl = this.configService.get<string>('githubOAuth.callbackUrl');

    if (!clientId) {
      throw new BadRequestException('GITHUB_OAUTH_CLIENT_ID is not configured on this server.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl ?? '',
      scope: 'repo read:org',
    });

    return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  /**
   * Exchanges a GitHub OAuth code for an access token.
   * Called by the Next.js API route /api/github/callback.
   */
  @Get('exchange')
  async exchangeCode(
    @Query('code') code: string,
  ): Promise<{ accessToken: string; login: string; avatarUrl: string }> {
    if (!code) {
      throw new BadRequestException('Missing code parameter');
    }

    const clientId = this.configService.get<string>('githubOAuth.clientId');
    const clientSecret = this.configService.get<string>('githubOAuth.clientSecret');
    const callbackUrl = this.configService.get<string>('githubOAuth.callbackUrl');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GitHub OAuth App credentials are not configured.');
    }

    // Exchange code for access token
    const tokenResponse = await axios.post<{
      access_token?: string;
      error?: string;
      error_description?: string;
    }>(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code, redirect_uri: callbackUrl },
      { headers: { Accept: 'application/json' } },
    );

    const {
      access_token: accessToken,
      error,
      error_description: errorDescription,
    } = tokenResponse.data;

    if (error || !accessToken) {
      throw new UnauthorizedException(errorDescription ?? error ?? 'GitHub token exchange failed');
    }

    // Fetch user profile
    const userResponse = await axios.get<{ login: string; avatar_url: string }>(
      'https://api.github.com/user',
      {
        headers: {
          Authorization: `token ${accessToken}`,
          'User-Agent': 'multi-agent-mcp',
        },
      },
    );

    return {
      accessToken,
      login: userResponse.data.login,
      avatarUrl: userResponse.data.avatar_url,
    };
  }

  /**
   * Lists repositories accessible to the authenticated GitHub user.
   * Expects `Authorization: Bearer <github_access_token>` header.
   */
  @Get('repositories')
  async listRepositories(
    @Headers('authorization') authHeader: string,
  ): Promise<{ repos: GitHubUserRepo[] }> {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    const response = await axios.get<GitHubUserRepo[]>(
      'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
      {
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'multi-agent-mcp',
          Accept: 'application/vnd.github+json',
        },
      },
    );

    return { repos: response.data };
  }
}
