import {
  Injectable,
  Inject,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AuthService } from '../../domain/services/auth.service';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import {
  IJwtService,
  JWT_SERVICE,
} from '../interfaces/jwt.service.interface';
import { RegisterDto } from '../dto/register.dto';

@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly authService: AuthService,
    @Inject(JWT_SERVICE)
    private readonly jwtService: IJwtService,
  ) {}

  async execute(
    registerDto: RegisterDto,
  ): Promise<{ accessToken: string; user: any }> {
    this.logger.log(`Registering user with email: ${registerDto.email}`);

    const existingUser = await this.userRepository.findByEmail(
      registerDto.email,
    );

    if (existingUser) {
      this.logger.warn(`User with email ${registerDto.email} already exists`);
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await this.authService.hashPassword(
      registerDto.password,
    );

    const user = await this.userRepository.create({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: registerDto.role || 'user',
      isActive: true,
    });

    this.logger.log(`User registered successfully: ${user.id}`);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }
}
