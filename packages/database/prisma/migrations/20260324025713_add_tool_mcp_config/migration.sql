-- AlterEnum
ALTER TYPE "ToolCategory" ADD VALUE 'MCP';

-- AlterTable
ALTER TABLE "tools" ADD COLUMN     "mcpConfig" JSONB;
