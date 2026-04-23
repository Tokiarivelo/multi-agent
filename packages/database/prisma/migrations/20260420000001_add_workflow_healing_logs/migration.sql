-- CreateTable
CREATE TABLE "workflow_healing_logs" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeName" TEXT,
    "nodeType" TEXT,
    "errorMessage" TEXT NOT NULL,
    "errorContext" JSONB NOT NULL,
    "suggestion" JSONB NOT NULL,
    "strategy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_healing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_healing_logs_executionId_idx" ON "workflow_healing_logs"("executionId");
