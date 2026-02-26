export interface NatsConfig {
  servers: string[];
  maxReconnectAttempts: number;
  reconnectTimeWait: number;
  maxDeliverAttempts: number;
}

export const defaultNatsConfig: NatsConfig = {
  servers: [process.env.NATS_URL || 'nats://nats:4222'],
  maxReconnectAttempts: -1, // Infinite
  reconnectTimeWait: 2000, // 2 seconds
  maxDeliverAttempts: 3,
};
