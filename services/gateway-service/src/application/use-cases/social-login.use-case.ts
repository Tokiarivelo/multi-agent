import { Injectable, Inject, Logger } from '@nestjs/common';
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
    this.logger.log(`Social login attempt for email: ${dto.email}`);

    let user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      this.logger.log(`Creating new user from social login: ${dto.email}`);
      // Create user
      user = await this.userRepository.create({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.USER,
        isActive: true,
        password: null as any, // Social user has no password
        provider: dto.provider,
        image: dto.image,
      });
    } else {
      // Update provider/image if needed?
      // For now, just login.
      // We might want to link account if provider differs.
    }

    if (!user.isActive) {
      throw new Error('Account inactive');
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _password, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }
}
