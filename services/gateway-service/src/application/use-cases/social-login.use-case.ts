import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { IJwtService, JWT_SERVICE } from '../interfaces/jwt.service.interface';
import { SocialLoginDto } from '../dto/social-login.dto';
import { UserRole } from '@multi-agent/database';

@Injectable()
export class SocialLoginUseCase {
  private readonly logger = new Logger(SocialLoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(JWT_SERVICE)
    private readonly jwtService: IJwtService,
  ) {}

  async execute(dto: SocialLoginDto): Promise<{ accessToken: string; user: any }> {
    this.logger.log(`Social login attempt via "${dto.provider}" for email: ${dto.email}`);

    let user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      this.logger.log(`Creating new user from social login: ${dto.email}`);
      user = await this.userRepository.create({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.USER,
        isActive: true,
        password: null as any, // Social users have no password
        provider: dto.provider,
        image: dto.image ?? null,
      });
    } else {
      // Refresh provider + avatar if coming from a different or updated social account
      const needsUpdate = user.provider !== dto.provider || (dto.image && user.image !== dto.image);

      if (needsUpdate) {
        this.logger.log(`Updating social profile for user: ${user.id}`);
        user = await this.userRepository.update(user.id, {
          provider: dto.provider,
          ...(dto.image ? { image: dto.image } : {}),
        });
      }
    }

    if (!user.isActive) {
      this.logger.warn(`Inactive social user attempted login: ${dto.email}`);
      throw new UnauthorizedException('Account is not active');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }
}
