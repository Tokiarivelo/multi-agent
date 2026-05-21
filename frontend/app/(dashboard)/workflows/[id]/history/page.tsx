"use client";

import { WorkflowHistoryPanel } from "@/features/workflows/components/WorkflowHistoryPanel";
import { useParams } from "next/navigation";

export default function WorkflowHistoryPage() {
  const params = useParams();
  const id = params.id as string;
  return <WorkflowHistoryPanel workflowId={id} />;
}
