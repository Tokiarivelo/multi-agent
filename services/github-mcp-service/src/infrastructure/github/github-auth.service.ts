import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';

interface CachedToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class GithubAuthService implements OnModuleInit {
  private readonly logger = new Logger(GithubAuthService.name);
  private readonly auth: ReturnType<typeof createAppAuth>;
  private cache: CachedToken | null = null;

  constructor(private readonly config: ConfigService) {
    this.auth = createAppAuth({
      appId: this.config.get<number>('github.appId')!,
      privateKey: this.config.get<string>('github.privateKey')!,
      installationId: this.config.get<number>('github.installationId')!,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.getInstallationToken();
    this.logger.log('GitHub App authenticated successfully');
  }

  async getInstallationToken(): Promise<string> {
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + 5 * 60 * 1000);

    if (this.cache && this.cache.expiresAt > refreshThreshold) {
      return this.cache.token;
    }

    this.logger.debug('Refreshing GitHub Installation Token');

    const { token, expiresAt } = (await this.auth({ type: 'installation' })) as {
      token: string;
      expiresAt: string;
    };

    this.cache = { token, expiresAt: new Date(expiresAt) };
    this.logger.debug(`Token cached, expires at ${this.cache.expiresAt.toISOString()}`);

    return token;
  }
}
