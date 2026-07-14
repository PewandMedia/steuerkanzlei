// Tiny in-memory cache with TTL. Shared across pages so switching between
// Dashboard, "Meine Mandanten" and detail pages doesn't refetch the same data.
const store = new Map<string, { at: number; data: unknown }>();

export function getCached<T>(key: string, ttlMs = 60_000): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > ttlMs) {
    store.delete(key);
    return undefined;
  }
  return hit.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { at: Date.now(), data });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of Array.from(store.keys())) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
