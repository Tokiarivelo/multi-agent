import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAppAuth } from '@octokit/auth-app';

interface CachedToken {
  token: string;
  expiresAt: Date;
}

const RETRY_DELAYS_MS = [1000, 3000, 10000];

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
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        await this.refreshToken();
        this.logger.log('GitHub App authenticated successfully');
        return;
      } catch (err) {
        const isLast = attempt === RETRY_DELAYS_MS.length;
        const delay = RETRY_DELAYS_MS[attempt] ?? 0;
        this.logger.warn(
          `GitHub auth attempt ${attempt + 1} failed: ${(err as Error).message}` +
            (isLast ? ' — service will start anyway; calls will retry on demand.' : ` — retrying in ${delay}ms`),
        );
        if (isLast) return;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  async getInstallationToken(): Promise<string> {
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + 5 * 60 * 1000);

    if (this.cache && this.cache.expiresAt > refreshThreshold) {
      return this.cache.token;
    }

    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    this.logger.debug('Refreshing GitHub Installation Token');

    const timeoutMs = 15_000;
    const { token, expiresAt } = await Promise.race([
      this.auth({ type: 'installation' }) as Promise<{ token: string; expiresAt: string }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`GitHub auth timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);

    this.cache = { token, expiresAt: new Date(expiresAt) };
    this.logger.debug(`Token cached, expires at ${this.cache.expiresAt.toISOString()}`);
    return token;
  }
}
