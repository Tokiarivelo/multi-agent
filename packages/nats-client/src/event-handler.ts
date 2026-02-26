import { DomainEvent } from '@multi-agent/events';

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

export type EventHandlerRegistry = Map<string, EventHandler>;
