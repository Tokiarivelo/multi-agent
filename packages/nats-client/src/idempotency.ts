/**
 * Idempotency Service
 * 
 * Ensures that events are processed exactly once by tracking processed event IDs.
 * In production, this should use a distributed cache like Redis.
 * For now, we use an in-memory Map with TTL.
 */

export class IdempotencyService {
  private processedEvents: Map<string, Date>;
  private readonly ttl: number = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.processedEvents = new Map();
    this.startCleanupTask();
  }

  async isProcessed(eventId: string): Promise<boolean> {
    return this.processedEvents.has(eventId);
  }

  async markProcessed(eventId: string): Promise<void> {
    this.processedEvents.set(eventId, new Date());
  }

  private startCleanupTask(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];

      for (const [eventId, timestamp] of this.processedEvents.entries()) {
        if (now - timestamp.getTime() > this.ttl) {
          expired.push(eventId);
        }
      }

      expired.forEach((eventId) => this.processedEvents.delete(eventId));

      if (expired.length > 0) {
        console.log(`Cleaned up ${expired.length} expired event IDs`);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }
}
