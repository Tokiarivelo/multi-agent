import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GithubAuthService } from './github-auth.service';

jest.mock('@octokit/auth-app', () => ({
  createAppAuth: jest.fn().mockReturnValue(
    jest.fn().mockResolvedValue({
      token: 'ghs_test_token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
  ),
}));

describe('GithubAuthService', () => {
  let service: GithubAuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GithubAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const map: Record<string, unknown> = {
                'github.appId': 123,
                'github.privateKey':
                  '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
                'github.installationId': 456,
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get(GithubAuthService);
  });

  it('returns a cached token on subsequent calls', async () => {
    const first = await service.getInstallationToken();
    const second = await service.getInstallationToken();
    expect(first).toBe(second);
    expect(first).toBe('ghs_test_token');
  });
});
