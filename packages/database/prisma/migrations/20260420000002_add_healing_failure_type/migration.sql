-- AlterTable: add failureType column with default TECHNICAL for existing rows
ALTER TABLE "workflow_healing_logs" ADD COLUMN "failureType" TEXT NOT NULL DEFAULT 'TECHNICAL';

-- CreateIndex
CREATE INDEX "workflow_healing_logs_failureType_idx" ON "workflow_healing_logs"("failureType");
