import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Infrastructure
import { ConfigModule } from './infrastructure/config/config.module';
import { PrismaService } from './infrastructure/database/prisma.service';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { JwtService } from './infrastructure/external/jwt.service';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';

// Domain
import { AuthService } from './domain/services/auth.service';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';

// Application
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RegisterUseCase } from './application/use-cases/register.use-case';
import { SocialLoginUseCase } from './application/use-cases/social-login.use-case';
import { JWT_SERVICE } from './application/interfaces/jwt.service.interface';

// Presentation
import { AuthController } from './presentation/controllers/auth.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { GatewaysModule } from './presentation/gateways/gateways.module';
import { NatsModule } from './infrastructure/messaging/nats.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [NestConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1d'),
        },
      }),
      inject: [ConfigService],
    }),
    NatsModule,
    GatewaysModule,
  ],
  controllers: [AuthController, HealthController],
  providers: [
    PrismaService,
    AuthService,
    JwtStrategy,
    LoginUseCase,
    RegisterUseCase,
    SocialLoginUseCase,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: JWT_SERVICE,
      useClass: JwtService,
    },
  ],
})
export class AppModule {}
