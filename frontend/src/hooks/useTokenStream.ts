import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { useExecutionStore } from "@/store/execution.store";
import { TokenStreamEvent } from "@/types";

export function useTokenStream(executionId: string | null) {
  const { subscribe, isConnected } = useWebSocket();
  const { appendToken, clearTokens } = useExecutionStore();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!executionId || !isConnected) return;

    const unsubscribe = subscribe(`execution.${executionId}.token`, (data) => {
      const event = data as TokenStreamEvent;

      switch (event.type) {
        case "token":
          if (event.token) {
            appendToken(executionId, event.token);
            setIsStreaming(true);
          }
          break;
        case "complete":
          setIsStreaming(false);
          break;
        case "error":
          setError(event.error || "Unknown error");
          setIsStreaming(false);
          break;
      }
    });

    return () => {
      unsubscribe();
      clearTokens(executionId);
    };
  }, [executionId, isConnected, subscribe, appendToken, clearTokens]);

  return { isStreaming, error };
}
