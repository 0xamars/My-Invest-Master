interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export const THEMES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const CUSTOM_THEME_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
