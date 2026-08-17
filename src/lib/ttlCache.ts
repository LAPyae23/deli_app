type CacheEntry<T> = { expiresAt: number; value: T };

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached != null) return Promise.resolve(cached);
  return loader().then((value) => {
    cacheSet(key, value, ttlMs);
    return value;
  });
}
