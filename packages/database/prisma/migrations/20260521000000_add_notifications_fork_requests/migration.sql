-- CreateEnum
CREATE TYPE "ForkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workflow_fork_requests
CREATE TABLE "workflow_fork_requests" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "ForkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_fork_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_fork_requests_workflowId_requesterId_key" ON "workflow_fork_requests"("workflowId", "requesterId");
CREATE INDEX "workflow_fork_requests_workflowId_idx" ON "workflow_fork_requests"("workflowId");
CREATE INDEX "workflow_fork_requests_requesterId_idx" ON "workflow_fork_requests"("requesterId");
CREATE INDEX "workflow_fork_requests_status_idx" ON "workflow_fork_requests"("status");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_fork_requests" ADD CONSTRAINT "workflow_fork_requests_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_fork_requests" ADD CONSTRAINT "workflow_fork_requests_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
