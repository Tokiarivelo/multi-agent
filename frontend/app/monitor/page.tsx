'use client';

import { useEffect, useState, useRef } from 'react';
import { natsClient } from '@/lib/nats-client';

interface LogEntry {
  id: string;
  timestamp: Date;
  event: string;
  data: unknown;
}

export default function MonitorPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when logs change
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    const connect = async () => {
      try {
        if (!natsClient.isConnected()) {
          await natsClient.connect();
        }
        setIsConnected(true);

        const unsubscribe = natsClient.subscribeAll((event, data) => {
          setLogs((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substring(7),
              timestamp: new Date(),
              event,
              data,
            },
          ]);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Failed to connect to WS', error);
        setIsConnected(false);
      }
    };

    let cleanupFn: (() => void) | undefined;
    connect().then((unsub) => {
      if (unsub) cleanupFn = unsub;
    });

    return () => {
      if (cleanupFn) cleanupFn();
      natsClient.disconnect();
      setIsConnected(false);
    };
  }, []);

  const clearLogs = () => setLogs([]);

  return (
    <div className="p-6 h-screen flex flex-col bg-gray-900 text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">WebSocket Flux Monitor</h1>
        <div className="flex items-center gap-4">
          <div
            className={`px-3 py-1 rounded text-sm ${isConnected ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <button
            onClick={clearLogs}
            className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 text-sm"
          >
            Clear Logs
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-black p-4 rounded-lg font-mono text-xs border border-gray-800">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">No events received yet...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="mb-2 border-b border-gray-800 pb-2">
              <div className="flex gap-2 text-gray-400 mb-1">
                <span className="text-blue-400">[{log.timestamp.toLocaleTimeString()}]</span>
                <span className="text-yellow-400 font-bold">{log.event}</span>
              </div>
              <pre className="text-green-300 whitespace-pre-wrap pl-4">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}
