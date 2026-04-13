-- CreateTable
CREATE TABLE IF NOT EXISTS "token_usage" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "executionId" TEXT,
    "workflowId" TEXT,
    "nodeId" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputPreview" TEXT,
    "outputPreview" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usage_userId_idx" ON "token_usage"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usage_agentId_idx" ON "token_usage"("agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usage_isTest_idx" ON "token_usage"("isTest");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "token_usage_timestamp_idx" ON "token_usage"("timestamp");

-- AddForeignKey
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
