export interface IEventPublisher {
  publish<T = any>(subject: string, data: T): Promise<void>;
}

export const IEventPublisher = Symbol('IEventPublisher');
