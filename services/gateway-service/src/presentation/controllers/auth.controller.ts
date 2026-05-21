import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../decorators/public.decorator';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { LoginDto } from '../../application/dto/login.dto';
import { RegisterDto } from '../../application/dto/register.dto';
import { SocialLoginDto } from '../../application/dto/social-login.dto';
import { SocialLoginUseCase } from '../../application/use-cases/social-login.use-case';
import { GetMeUseCase } from '../../application/use-cases/get-me.use-case';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly socialLoginUseCase: SocialLoginUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.registerUseCase.execute(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.loginUseCase.execute(loginDto);
  }

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'OAuth Social Login',
    description:
      'Called by NextAuth after a successful Google/GitHub OAuth flow. Creates or logs in a user and returns a backend JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in via social provider. Returns accessToken + user.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'uuid',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          provider: 'google',
          role: 'USER',
          image: 'https://example.com/avatar.jpg',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Account inactive' })
  async socialLogin(@Body() socialLoginDto: SocialLoginDto) {
    return this.socialLoginUseCase.execute(socialLoginDto);
  }

  @Public()
  @Get('invitation-preview')
  @ApiOperation({ summary: 'Get invitation details by token — public, no auth required' })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  @ApiResponse({ status: 404, description: 'Invitation not found or expired' })
  async invitationPreview(@Query('token') token: string) {
    const base = this.configService.get<string>(
      'ORCHESTRATION_SERVICE_URL',
      'http://localhost:3003',
    );
    const res = await fetch(
      `${base}/workflows/invitations/by-token?token=${encodeURIComponent(token)}`,
    );
    if (!res.ok) throw new NotFoundException('Invitation not found or expired');
    return res.json();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user' })
  @ApiResponse({
    status: 200,
    description: 'Current user details',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getMe(@Req() req: any) {
    return this.getMeUseCase.execute(req.user.userId);
  }
}
