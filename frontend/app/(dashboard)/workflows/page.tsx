"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkflowList } from "@/features/workflows/components/WorkflowList";

function WorkflowsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowId = searchParams.get("workflowId");
  const executionId = searchParams.get("executionId");

  useEffect(() => {
    if (workflowId) {
      const target = `/workflows/${workflowId}${executionId ? `?executionId=${executionId}` : ""}`;
      router.replace(target);
    }
  }, [workflowId, executionId, router]);

  if (workflowId) return null; // Let the redirect happen

  return <WorkflowList />;
}

export default function WorkflowsPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowsPageContent />
    </Suspense>
  );
}
