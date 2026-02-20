import { Injectable, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthService } from '../../domain/services/auth.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { IJwtService, JWT_SERVICE } from '../interfaces/jwt.service.interface';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authService: AuthService,
    @Inject(JWT_SERVICE)
    private readonly jwtService: IJwtService,
  ) {}

  async execute(loginDto: LoginDto): Promise<{ accessToken: string; user: any }> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    const user = await this.userRepository.findByEmail(loginDto.email);

    if (!user) {
      this.logger.warn(`User not found: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      this.logger.warn(`Inactive user attempted login: ${loginDto.email}`);
      throw new UnauthorizedException('Account is not active');
    }

    if (!user.password) {
      this.logger.warn(`User has no password: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authService.validatePassword(loginDto.password, user.password);

    this.logger.log(`User logged in successfully: ${user.id}`);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }
}
