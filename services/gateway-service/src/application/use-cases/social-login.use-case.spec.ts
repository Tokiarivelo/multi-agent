import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { SocialLoginUseCase } from './social-login.use-case';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { JWT_SERVICE } from '../interfaces/jwt.service.interface';
import { UserRole } from '@multi-agent/database';

const mockUserRepository = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

const baseUser = {
  id: 'user-uuid-1',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  password: null,
  provider: 'google',
  image: 'https://example.com/avatar.jpg',
  role: UserRole.USER,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const socialLoginDto = {
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  provider: 'google',
  providerAccountId: 'google-uid-123',
  image: 'https://example.com/avatar.jpg',
};

describe('SocialLoginUseCase', () => {
  let useCase: SocialLoginUseCase;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialLoginUseCase,
        { provide: USER_REPOSITORY, useValue: mockUserRepository },
        { provide: JWT_SERVICE, useValue: mockJwtService },
      ],
    }).compile();

    useCase = module.get<SocialLoginUseCase>(SocialLoginUseCase);
  });

  describe('when the user does not exist', () => {
    it('should create a new user and return a JWT token', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(baseUser);
      mockJwtService.sign.mockReturnValue('signed-jwt-token');

      const result = await useCase.execute(socialLoginDto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(socialLoginDto.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: socialLoginDto.email,
          firstName: socialLoginDto.firstName,
          lastName: socialLoginDto.lastName,
          provider: socialLoginDto.provider,
          image: socialLoginDto.image,
          password: null,
          isActive: true,
          role: UserRole.USER,
        }),
      );
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
      });
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('when the user already exists', () => {
    it('should login the existing user and return a JWT token without updating', async () => {
      // Same provider, same image → no update needed
      const existingUser = { ...baseUser };
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mockJwtService.sign.mockReturnValue('signed-jwt-token');

      const result = await useCase.execute(socialLoginDto);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt-token');
    });

    it('should update provider and image when they differ', async () => {
      const existingUser = { ...baseUser, provider: 'credentials', image: null };
      const updatedUser = { ...baseUser, provider: 'google', image: socialLoginDto.image };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);
      mockJwtService.sign.mockReturnValue('signed-jwt-token');

      const result = await useCase.execute(socialLoginDto);

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({ provider: 'google', image: socialLoginDto.image }),
      );
      expect(result.accessToken).toBe('signed-jwt-token');
    });

    it('should throw UnauthorizedException when user account is inactive', async () => {
      const inactiveUser = { ...baseUser, isActive: false };
      mockUserRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(useCase.execute(socialLoginDto)).rejects.toThrow(UnauthorizedException);
      await expect(useCase.execute(socialLoginDto)).rejects.toThrow('Account is not active');
      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('when the user object does not expose password in result', () => {
    it('should omit password field from returned user object', async () => {
      const userWithPassword = { ...baseUser, password: 'hashed-secret' };
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(userWithPassword);
      mockJwtService.sign.mockReturnValue('token');

      const result = await useCase.execute(socialLoginDto);

      expect(result.user).not.toHaveProperty('password');
    });
  });
});
