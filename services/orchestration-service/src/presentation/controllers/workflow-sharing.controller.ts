import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { InviteCollaboratorUseCase } from '../../application/use-cases/invite-collaborator.use-case';
import { ManageInvitationUseCase } from '../../application/use-cases/manage-invitation.use-case';
import { ManageAccessRequestUseCase } from '../../application/use-cases/manage-access-request.use-case';
import { ForkWorkflowUseCase } from '../../application/use-cases/fork-workflow.use-case';
import { WorkflowChangeLogUseCase } from '../../application/use-cases/workflow-change-log.use-case';
import { ManageWorkflowSharingUseCase } from '../../application/use-cases/manage-workflow-sharing.use-case';
import { ForkRequestUseCase } from '../../application/use-cases/fork-request.use-case';
import {
  InviteCollaboratorDto,
  UpdateCollaboratorRoleDto,
  SetVisibilityDto,
  AcceptInvitationDto,
  RequestAccessDto,
  RespondToAccessRequestDto,
  RespondToForkRequestDto,
  ForkWorkflowDto,
} from '../../application/dto/workflow-sharing.dto';
import { WorkflowRoleGuard } from '../guards/workflow-role.guard';
import { RequireWorkflowRole } from '../decorators/workflow-role.decorator';

@ApiTags('Workflow Sharing')
@Controller('workflows')
@UseGuards(WorkflowRoleGuard)
export class WorkflowSharingController {
  private readonly logger = new Logger(WorkflowSharingController.name);

  constructor(
    private readonly inviteCollaboratorUseCase: InviteCollaboratorUseCase,
    private readonly manageInvitationUseCase: ManageInvitationUseCase,
    private readonly manageAccessRequestUseCase: ManageAccessRequestUseCase,
    private readonly forkWorkflowUseCase: ForkWorkflowUseCase,
    private readonly changeLogUseCase: WorkflowChangeLogUseCase,
    private readonly manageSharingUseCase: ManageWorkflowSharingUseCase,
    private readonly forkRequestUseCase: ForkRequestUseCase,
  ) {}

  // ─── Public listing ───────────────────────────────────────────────────────

  @Get('public')
  @ApiOperation({ summary: 'List all public workflows' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listPublic(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.manageSharingUseCase.listPublicWorkflows(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('shared-with-me')
  @ApiOperation({ summary: 'List workflows shared with the requesting user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listSharedWithMe(
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.manageSharingUseCase.listSharedWithMe(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ─── Visibility ───────────────────────────────────────────────────────────

  @Put(':id/visibility')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'Set workflow visibility (PRIVATE / PUBLIC)' })
  @ApiParam({ name: 'id', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  async setVisibility(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: SetVisibilityDto,
  ) {
    this.logger.log(`Setting visibility of workflow ${id} to ${dto.visibility}`);
    await this.manageSharingUseCase.setVisibility(id, userId, dto.visibility);
  }

  // ─── Collaborators ────────────────────────────────────────────────────────

  @Get(':id/collaborators')
  @RequireWorkflowRole('VIEWER')
  @ApiOperation({ summary: 'List collaborators on a workflow' })
  @ApiParam({ name: 'id', type: String })
  async listCollaborators(@Param('id') id: string, @Query('userId') userId: string) {
    return this.manageSharingUseCase.listCollaborators(id, userId);
  }

  @Post(':id/collaborators/invite')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'Invite a user by email to collaborate' })
  @ApiParam({ name: 'id', type: String })
  async inviteCollaborator(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: InviteCollaboratorDto,
  ) {
    this.logger.log(`Inviting ${dto.email} to workflow ${id}`);
    return this.inviteCollaboratorUseCase.execute(id, userId, dto);
  }

  @Put(':id/collaborators/:collaboratorId')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'Update a collaborator role' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'collaboratorId', type: String })
  async updateCollaboratorRole(
    @Param('id') id: string,
    @Param('collaboratorId') collaboratorId: string,
    @Query('userId') userId: string,
    @Body() dto: UpdateCollaboratorRoleDto,
  ) {
    return this.manageSharingUseCase.updateCollaboratorRole(id, collaboratorId, userId, dto.role);
  }

  @Delete(':id/collaborators/:collaboratorId')
  @RequireWorkflowRole('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a collaborator from a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'collaboratorId', type: String })
  async removeCollaborator(
    @Param('id') id: string,
    @Param('collaboratorId') collaboratorId: string,
    @Query('userId') userId: string,
  ) {
    await this.manageSharingUseCase.removeCollaborator(id, collaboratorId, userId);
  }

  // ─── Invitations ──────────────────────────────────────────────────────────

  @Get('invitations/pending')
  @ApiOperation({ summary: 'List pending invitations for the requesting user' })
  @ApiQuery({ name: 'userId', required: true, type: String })
  async listPendingInvitations(@Query('userId') userId: string) {
    return this.manageInvitationUseCase.listPendingForUser(userId);
  }

  @Get('invitations/by-token')
  @ApiOperation({ summary: 'Get invitation details by token' })
  @ApiQuery({ name: 'token', required: true, type: String })
  async getInvitationByToken(@Query('token') token: string) {
    return this.manageInvitationUseCase.getByToken(token);
  }

  @Post('invitations/accept')
  @ApiOperation({ summary: 'Accept an invitation via token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Query('userId') userId: string) {
    await this.manageInvitationUseCase.accept(dto.token, userId);
  }

  @Post('invitations/decline')
  @ApiOperation({ summary: 'Decline an invitation via token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineInvitation(@Body() dto: AcceptInvitationDto, @Query('userEmail') userEmail: string) {
    await this.manageInvitationUseCase.decline(dto.token, userEmail);
  }

  // ─── Access Requests ──────────────────────────────────────────────────────

  @Get(':id/access-requests')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'List access requests for a public workflow (owner only)' })
  @ApiParam({ name: 'id', type: String })
  async listAccessRequests(@Param('id') id: string, @Query('userId') userId: string) {
    return this.manageAccessRequestUseCase.listForWorkflow(id, userId);
  }

  @Post(':id/access-requests')
  @ApiOperation({ summary: 'Request access to a public workflow' })
  @ApiParam({ name: 'id', type: String })
  async requestAccess(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: RequestAccessDto,
  ) {
    this.logger.log(`User ${userId} requesting access to workflow ${id}`);
    return this.manageAccessRequestUseCase.requestAccess(id, userId, dto.message);
  }

  @Put(':id/access-requests/:requestId/respond')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'Approve or deny an access request (owner only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'requestId', type: String })
  async respondToAccessRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Query('userId') userId: string,
    @Body() dto: RespondToAccessRequestDto,
  ) {
    return this.manageAccessRequestUseCase.respond(id, requestId, userId, dto.decision);
  }

  // ─── Fork Requests ────────────────────────────────────────────────────────

  @Get('fork-requests/incoming')
  @ApiOperation({ summary: 'List all incoming (PENDING) fork requests across owned workflows' })
  async listIncomingForkRequests(@Query('userId') userId: string) {
    return this.forkRequestUseCase.listAllIncoming(userId);
  }

  @Post(':id/fork-requests')
  @ApiOperation({ summary: 'Request permission to fork a public workflow' })
  @ApiParam({ name: 'id', type: String })
  async requestFork(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: RequestAccessDto,
  ) {
    this.logger.log(`User ${userId} requesting to ${dto.type ?? 'fork'} workflow ${id}`);
    return this.forkRequestUseCase.requestFork(id, userId, dto.message, dto.type);
  }

  @Get(':id/fork-requests')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'List fork requests for a workflow (owner only)' })
  @ApiParam({ name: 'id', type: String })
  async listForkRequests(@Param('id') id: string, @Query('userId') userId: string) {
    return this.forkRequestUseCase.listForWorkflow(id, userId);
  }

  @Put(':id/fork-requests/:requestId/respond')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'Approve or reject a fork request (owner only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiParam({ name: 'requestId', type: String })
  async respondToForkRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Query('userId') userId: string,
    @Body() dto: RespondToForkRequestDto,
  ) {
    return this.forkRequestUseCase.respond(id, requestId, userId, dto.decision);
  }

  // ─── Forking ──────────────────────────────────────────────────────────────

  @Post(':id/fork')
  @ApiOperation({ summary: 'Fork a workflow' })
  @ApiParam({ name: 'id', type: String })
  async fork(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() dto: ForkWorkflowDto,
  ) {
    this.logger.log(`User ${userId} forking workflow ${id}`);
    return this.forkWorkflowUseCase.execute(id, userId, dto);
  }

  @Get(':id/fork/upstream-changes')
  @RequireWorkflowRole('VIEWER')
  @ApiOperation({ summary: 'Check if upstream has changes relative to this fork' })
  @ApiParam({ name: 'id', type: String })
  async checkUpstreamChanges(@Param('id') id: string, @Query('userId') userId: string) {
    return this.forkWorkflowUseCase.checkUpstreamChanges(id, userId);
  }

  @Post(':id/fork/pull')
  @RequireWorkflowRole('OWNER')
  @ApiOperation({ summary: 'Pull upstream changes into this fork' })
  @ApiParam({ name: 'id', type: String })
  async pullUpstreamChanges(@Param('id') id: string, @Query('userId') userId: string) {
    return this.forkWorkflowUseCase.pullUpstreamChanges(id, userId);
  }

  // ─── Change History ───────────────────────────────────────────────────────

  @Get(':id/history')
  @RequireWorkflowRole('VIEWER')
  @ApiOperation({ summary: 'Get change history for a workflow' })
  @ApiParam({ name: 'id', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.changeLogUseCase.getHistory(
      id,
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 30,
    );
  }
}
