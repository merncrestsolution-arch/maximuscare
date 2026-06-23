/**
 * Cache layer — Redis when REDIS_URL is set, otherwise in-memory TTL map.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

import type { Redis } from "ioredis";

let redisClient: Redis | null = null;

let redisInit: Promise<void> | null = null;

async function ensureRedis(): Promise<void> {
  if (redisClient || !process.env.REDIS_URL) return;
  if (!redisInit) {
    redisInit = (async () => {
      try {
        const { default: Redis } = await import("ioredis");
        const client = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2, lazyConnect: true });
        await client.connect();
        redisClient = client;
      } catch (err) {
        console.warn("[cache] Redis unavailable, using in-memory cache:", (err as Error).message);
        redisClient = null;
      }
    })();
  }
  await redisInit;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  await ensureRedis();
  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      if (!raw) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      /* fallback */
    }
  }
  const entry = memoryStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 120): Promise<void> {
  await ensureRedis();
  if (redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
      return;
    } catch {
      /* fallback */
    }
  }
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDelete(key: string): Promise<void> {
  await ensureRedis();
  if (redisClient) {
    try {
      await redisClient.del(key);
    } catch {
      /* fallback */
    }
  }
  memoryStore.delete(key);
}

export async function cacheDeletePrefix(prefix: string): Promise<void> {
  await ensureRedis();
  if (redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`);
      if (keys.length) await redisClient.del(...keys);
    } catch {
      /* fallback */
    }
  }
  for (const key of Array.from(memoryStore.keys())) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  factory: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== undefined) return cached;
  const value = await factory();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

/** Bust dashboard/report caches after visits, sessions, attendance, or fines change. */
export async function invalidateOperationalCaches(): Promise<void> {
  await cacheDeletePrefix("dashboard:");
  await cacheDeletePrefix("report:");
}

/** Sync wrappers for legacy callers — prefer async versions. */
export function cacheGetSync<T>(key: string): T | undefined {
  const entry = memoryStore.get(key);
  if (!entry || Date.now() > entry.expiresAt) return undefined;
  return entry.value as T;
}

export function cacheSetSync<T>(key: string, value: T, ttlSeconds = 120): void {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
