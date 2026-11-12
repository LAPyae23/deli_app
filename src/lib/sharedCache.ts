/**
 * Two-level cache shared by every server instance.
 *
 *  L1: in-memory map in this instance (fastest, lost on cold start)
 *  L2: Upstash Redis over REST when UPSTASH_REDIS_REST_URL / _TOKEN (or
 *      Vercel KV's KV_REST_API_URL / _TOKEN) are set; otherwise a MongoDB
 *      collection with a TTL index, so the app works with no extra service.
 *
 * Values must be JSON (they are stored as text in L2).
 */
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import { cacheGet, cacheSet } from '@/lib/ttlCache';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

const CacheEntrySchema = new mongoose.Schema({
  _id: { type: String },
  value: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});
CacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const CacheEntry =
  (mongoose.models.CacheEntry as mongoose.Model<{ _id: string; value: string; expiresAt: Date }>) ||
  mongoose.model('CacheEntry', CacheEntrySchema);

const stats = { l1Hits: 0, l2Hits: 0, misses: 0, l2Errors: 0 };

async function redis(command: unknown[]) {
  const res = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()) as { result: unknown };
}

async function l2Get(key: string): Promise<string | null> {
  if (useRedis) {
    const { result } = await redis(['GET', key]);
    return typeof result === 'string' ? result : null;
  }
  await dbConnect();
  const hit = await CacheEntry.findById(key).lean();
  return hit && hit.expiresAt.getTime() > Date.now() ? hit.value : null;
}

async function l2Set(key: string, value: string, ttlMs: number) {
  if (useRedis) {
    await redis(['SET', key, value, 'PX', Math.max(1000, Math.round(ttlMs))]);
    return;
  }
  await dbConnect();
  await CacheEntry.updateOne(
    { _id: key },
    { $set: { value, expiresAt: new Date(Date.now() + ttlMs) } },
    { upsert: true }
  );
}

export async function sharedGetOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const local = cacheGet<T>(key);
  if (local != null) {
    stats.l1Hits++;
    return local;
  }
  try {
    const remote = await l2Get(key);
    if (remote != null) {
      stats.l2Hits++;
      const value = JSON.parse(remote) as T;
      cacheSet(key, value, Math.min(ttlMs, 10_000));
      return value;
    }
  } catch {
    stats.l2Errors++;
  }
  stats.misses++;
  const value = await loader();
  cacheSet(key, value, ttlMs);
  l2Set(key, JSON.stringify(value), ttlMs).catch(() => {
    stats.l2Errors++;
  });
  return value;
}

export function cacheInfo() {
  return { backend: useRedis ? 'redis' : 'mongodb', ...stats };
}
