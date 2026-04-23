-- Add isTest flag to workflow_healing_logs for node-level test outcome analysis
ALTER TABLE "workflow_healing_logs" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
