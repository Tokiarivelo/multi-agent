import { UserRole } from '@multi-agent/database';

export class User {
  id!: string;
  email!: string;
  password?: string | null;
  firstName!: string;
  lastName!: string;
  role!: UserRole;
  isActive!: boolean;
  provider?: string | null;
  image?: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  hasRole(role: UserRole): boolean {
    return this.role === role;
  }

  activate(): void {
    this.isActive = true;
  }

  deactivate(): void {
    this.isActive = false;
  }
}
