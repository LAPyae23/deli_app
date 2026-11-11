/**
 * Fixed-window rate limiting stored in MongoDB, so every Vercel instance
 * shares the same counters. Expired windows are removed by a TTL index.
 */
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';

const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  resetAt: { type: Date, required: true },
});
RateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit =
  (mongoose.models.RateLimit as mongoose.Model<{ key: string; count: number; resetAt: Date }>) ||
  mongoose.model('RateLimit', RateLimitSchema);

export type RateLimitResult = { allowed: boolean; count: number; remaining: number; retryAfterSec: number };

function result(count: number, limit: number, resetAt: Date): RateLimitResult {
  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
    retryAfterSec: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Count one hit for `key`; allowed while hits in the window ≤ limit. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  await dbConnect();
  const now = new Date();
  const live = await RateLimit.findOneAndUpdate(
    { key, resetAt: { $gt: now } },
    { $inc: { count: 1 } },
    { new: true }
  ).lean();
  if (live) return result(live.count, limit, live.resetAt);
  const resetAt = new Date(now.getTime() + windowMs);
  try {
    const fresh = await RateLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, resetAt } },
      { upsert: true, new: true }
    ).lean();
    return result(fresh?.count ?? 1, limit, fresh?.resetAt ?? resetAt);
  } catch {
    // Two first hits raced on the unique key — count this one on the winner's window.
    return rateLimit(key, limit, windowMs);
  }
}

/** Current hits for `key` without counting a new one. */
export async function peekRateLimit(key: string, limit: number): Promise<RateLimitResult> {
  await dbConnect();
  const doc = await RateLimit.findOne({ key, resetAt: { $gt: new Date() } }).lean();
  if (!doc) return { allowed: true, count: 0, remaining: limit, retryAfterSec: 0 };
  return { ...result(doc.count, limit, doc.resetAt), allowed: doc.count < limit };
}

export async function resetRateLimit(key: string) {
  await dbConnect();
  await RateLimit.deleteOne({ key });
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
