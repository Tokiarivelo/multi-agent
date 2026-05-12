-- CreateTable
CREATE TABLE "gmail_watch_subscriptions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailUser" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "labelIds" JSONB NOT NULL DEFAULT '["INBOX"]',
    "historyId" TEXT,
    "expiration" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_watch_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gmail_watch_subscriptions_gmailUser_idx" ON "gmail_watch_subscriptions"("gmailUser");

-- CreateIndex
CREATE INDEX "gmail_watch_subscriptions_isActive_idx" ON "gmail_watch_subscriptions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_watch_subscriptions_workflowId_gmailUser_key" ON "gmail_watch_subscriptions"("workflowId", "gmailUser");
