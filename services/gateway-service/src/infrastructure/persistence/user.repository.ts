import { Injectable, Logger } from '@nestjs/common';
import {
  IUserRepository,
  PaginatedUsers,
} from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { PrismaService } from '../database/prisma.service';
import { UserRole, Prisma } from '@multi-agent/database';

@Injectable()
export class UserRepository implements IUserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      return user ? new User(user) : null;
    } catch (error) {
      this.logger.error(`Failed to find user by id: ${id}`, error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      return user ? new User(user) : null;
    } catch (error) {
      this.logger.error(`Failed to find user by email: ${email}`, error);
      throw error;
    }
  }

  async create(userData: {
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
    provider?: string | null;
    image?: string | null;
  }): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          ...userData,
          password: userData.password || undefined,
          provider: userData.provider || 'credentials',
        },
      });

      this.logger.log(`User created: ${user.id}`);
      return new User(user);
    } catch (error) {
      this.logger.error('Failed to create user', error);
      throw error;
    }
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: userData as Prisma.UserUpdateInput,
      });

      this.logger.log(`User updated: ${id}`);
      return new User(user);
    } catch (error) {
      this.logger.error(`Failed to update user: ${id}`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`User deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete user: ${id}`, error);
      throw error;
    }
  }

  async findAll(pageParam: number = 1, limitParam: number = 20): Promise<PaginatedUsers> {
    try {
      const page = pageParam || 1;
      const limit = limitParam || 20;
      const skip = (page - 1) * limit;

      const [total, users] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.findMany({ skip, take: limit }),
      ]);

      return {
        data: users.map((user) => new User(user)),
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to find all users', error);
      throw error;
    }
  }
}
