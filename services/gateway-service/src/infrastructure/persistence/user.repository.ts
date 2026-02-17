import { Injectable, Logger } from '@nestjs/common';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { PrismaService } from '../database/prisma.service';

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

  async create(
    userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
      isActive: boolean;
    },
  ): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: userData,
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
        data: userData,
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

  async findAll(): Promise<User[]> {
    try {
      const users = await this.prisma.user.findMany();
      return users.map((user) => new User(user));
    } catch (error) {
      this.logger.error('Failed to find all users', error);
      throw error;
    }
  }
}
