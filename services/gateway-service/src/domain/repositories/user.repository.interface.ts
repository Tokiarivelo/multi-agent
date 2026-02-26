import { User } from '../entities/user.entity';
import { UserRole } from '@multi-agent/database';

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: {
    email: string;
    password?: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
    provider?: string | null;
    image?: string | null;
  }): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  findAll(page?: number, limit?: number): Promise<PaginatedUsers>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
