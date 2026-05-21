-- CreateEnum
CREATE TYPE "WorkflowVisibility" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('VIEWER', 'EXECUTOR', 'EDITOR');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('CREATED', 'NODE_ADDED', 'NODE_UPDATED', 'NODE_REMOVED', 'EDGE_ADDED', 'EDGE_REMOVED', 'STATUS_CHANGED', 'VISIBILITY_CHANGED', 'SETTINGS_UPDATED', 'FORKED');

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "forkedFromId" TEXT,
ADD COLUMN     "visibility" "WorkflowVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "workflow_collaborators" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "workflow_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_invitations" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_access_requests" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_change_logs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ChangeAction" NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_collaborators_workflowId_idx" ON "workflow_collaborators"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_collaborators_userId_idx" ON "workflow_collaborators"("userId");

-- CreateIndex
CREATE INDEX "workflow_collaborators_status_idx" ON "workflow_collaborators"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_collaborators_workflowId_userId_key" ON "workflow_collaborators"("workflowId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_invitations_token_key" ON "workflow_invitations"("token");

-- CreateIndex
CREATE INDEX "workflow_invitations_workflowId_idx" ON "workflow_invitations"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_invitations_email_idx" ON "workflow_invitations"("email");

-- CreateIndex
CREATE INDEX "workflow_invitations_token_idx" ON "workflow_invitations"("token");

-- CreateIndex
CREATE INDEX "workflow_invitations_status_idx" ON "workflow_invitations"("status");

-- CreateIndex
CREATE INDEX "workflow_access_requests_workflowId_idx" ON "workflow_access_requests"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_access_requests_requesterId_idx" ON "workflow_access_requests"("requesterId");

-- CreateIndex
CREATE INDEX "workflow_access_requests_status_idx" ON "workflow_access_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_access_requests_workflowId_requesterId_key" ON "workflow_access_requests"("workflowId", "requesterId");

-- CreateIndex
CREATE INDEX "workflow_change_logs_workflowId_idx" ON "workflow_change_logs"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_change_logs_userId_idx" ON "workflow_change_logs"("userId");

-- CreateIndex
CREATE INDEX "workflow_change_logs_createdAt_idx" ON "workflow_change_logs"("createdAt");

-- CreateIndex
CREATE INDEX "workflows_visibility_idx" ON "workflows"("visibility");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_collaborators" ADD CONSTRAINT "workflow_collaborators_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_collaborators" ADD CONSTRAINT "workflow_collaborators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_collaborators" ADD CONSTRAINT "workflow_collaborators_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_invitations" ADD CONSTRAINT "workflow_invitations_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_invitations" ADD CONSTRAINT "workflow_invitations_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_access_requests" ADD CONSTRAINT "workflow_access_requests_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_access_requests" ADD CONSTRAINT "workflow_access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_change_logs" ADD CONSTRAINT "workflow_change_logs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_change_logs" ADD CONSTRAINT "workflow_change_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
