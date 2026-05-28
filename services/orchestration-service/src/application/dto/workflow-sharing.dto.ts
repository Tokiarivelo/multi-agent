import { IsString, IsEmail, IsEnum, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CollaboratorRole } from '../../domain/entities/workflow-collaboration.entity';
import { WorkflowVisibility } from '../../domain/entities/workflow.entity';

export class InviteCollaboratorDto {
  @ApiProperty({ description: 'Email of the user to invite' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: CollaboratorRole })
  @IsEnum(CollaboratorRole)
  role!: CollaboratorRole;
}

export class UpdateCollaboratorRoleDto {
  @ApiProperty({ enum: CollaboratorRole })
  @IsEnum(CollaboratorRole)
  role!: CollaboratorRole;
}

export class SetVisibilityDto {
  @ApiProperty({ enum: WorkflowVisibility })
  @IsEnum(WorkflowVisibility)
  visibility!: WorkflowVisibility;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token from the email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class RequestAccessDto {
  @ApiPropertyOptional({ description: 'Optional message to the workflow owner' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({
    enum: ['fork', 'view'],
    description: 'Request type: fork (default) or view',
  })
  @IsOptional()
  @IsEnum(['fork', 'view'])
  type?: 'fork' | 'view';
}

export class RespondToAccessRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'DENIED'] })
  @IsEnum(['APPROVED', 'DENIED'])
  decision!: 'APPROVED' | 'DENIED';
}

export class RespondToForkRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}

export class ForkWorkflowDto {
  @ApiPropertyOptional({ description: 'Custom name for the fork' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
