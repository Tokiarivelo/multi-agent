import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface InstallerRecord {
  installerId: string;
  email: string;
  firstName: string;
  lastName: string;
  installedAt: Date;
}

export interface MyPublishedWorkflow {
  id: string;
  name: string;
  category: string | null;
  installsCount: number;
  isFeatured: boolean;
  isTemplate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GetInstallersUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async getInstallers(templateId: string, requesterId: string): Promise<InstallerRecord[]> {
    const template = await this.prisma.workflow.findUnique({
      where: { id: templateId },
      select: { id: true, userId: true, isTemplate: true },
    });

    if (!template) throw new NotFoundException(`Template ${templateId} not found`);
    if (template.userId !== requesterId) {
      throw new ForbiddenException('Only the template owner can view installers');
    }

    const installations = await this.prisma.workflowInstallation.findMany({
      where: { templateId },
      include: {
        installer: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { installedAt: 'desc' },
    });

    return installations.map((inst) => ({
      installerId: inst.installer.id,
      email: inst.installer.email,
      firstName: inst.installer.firstName,
      lastName: inst.installer.lastName,
      installedAt: inst.installedAt,
    }));
  }

  async getMyPublished(userId: string): Promise<MyPublishedWorkflow[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: { userId, isTemplate: true },
      select: {
        id: true,
        name: true,
        category: true,
        installsCount: true,
        isFeatured: true,
        isTemplate: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return workflows as MyPublishedWorkflow[];
  }
}
