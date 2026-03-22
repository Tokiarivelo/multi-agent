import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';

@Injectable()
export class GetUserSettingsUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Default settings if empty
    const defaultSettings = {
      indexableExtensions: [
        'txt',
        'md',
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'yaml',
        'yml',
        'py',
        'go',
        'rs',
        'java',
        'css',
        'html',
        'xml',
        'sh',
        'env',
        'toml',
        'ini',
        'sql',
        'graphql',
        'prisma',
        'proto',
      ],
    };

    return {
      settings:
        user.settings && Object.keys(user.settings as any).length > 0
          ? user.settings
          : defaultSettings,
    };
  }
}
