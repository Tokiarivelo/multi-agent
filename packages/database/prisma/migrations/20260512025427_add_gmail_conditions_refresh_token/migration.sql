-- AlterTable
ALTER TABLE "gmail_watch_subscriptions" ADD COLUMN     "conditions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "refreshToken" TEXT;

-- AddForeignKey
ALTER TABLE "gmail_watch_subscriptions" ADD CONSTRAINT "gmail_watch_subscriptions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
