import { useEffect, useState, useCallback } from "react";
import { natsClient } from "@/lib/nats-client";

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        await natsClient.connect();
        setIsConnected(true);
      } catch (error) {
        console.error("Failed to connect WebSocket:", error);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      natsClient.disconnect();
      setIsConnected(false);
    };
  }, []);

  const subscribe = useCallback(
    (event: string, callback: (data: unknown) => void) => {
      return natsClient.subscribe(event, callback);
    },
    []
  );

  const send = useCallback((event: string, data: unknown) => {
    natsClient.send(event, data);
  }, []);

  return { isConnected, subscribe, send };
}
