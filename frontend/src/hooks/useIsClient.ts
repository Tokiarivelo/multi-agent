import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * A hook that returns true when the component is rendered on the client.
 * This is hydration-safe and avoids "cascading renders" warnings by using
 * useSyncExternalStore.
 */
export function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // Client-side value
    () => false // Server-side value (initial hydration)
  );
}
