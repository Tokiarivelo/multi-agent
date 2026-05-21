import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { WORKFLOW_ROLE_KEY, WorkflowRoleLevel } from '../decorators/workflow-role.decorator';

const ROLE_RANK: Record<string, number> = {
  VIEWER: 0,
  EXECUTOR: 1,
  EDITOR: 2,
  OWNER: 3,
};

@Injectable()
export class WorkflowRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.get<WorkflowRoleLevel>(
      WORKFLOW_ROLE_KEY,
      context.getHandler(),
    );
    if (!requiredRole) return true;

    const request = context.switchToHttp().getRequest();
    const workflowId: string | undefined = request.params?.id;
    const userId: string | undefined = request.query?.userId;

    if (!workflowId || !userId) {
      throw new ForbiddenException('Missing workflow ID or user identity');
    }

    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');

    if (workflow.userId === userId) return true;

    // PUBLIC workflows allow any authenticated user at VIEWER level
    if (workflow.visibility === 'PUBLIC' && requiredRole === 'VIEWER') return true;

    const collaborator = await this.prisma.workflowCollaborator.findUnique({
      where: { workflowId_userId: { workflowId, userId } },
    });

    if (!collaborator || collaborator.status !== 'ACCEPTED') {
      throw new ForbiddenException('You do not have access to this workflow');
    }

    const userRank = ROLE_RANK[collaborator.role] ?? -1;
    const requiredRank = ROLE_RANK[requiredRole] ?? 0;

    if (userRank < requiredRank) {
      throw new ForbiddenException(
        `This action requires at least ${requiredRole} role on the workflow`,
      );
    }

    return true;
  }
}
