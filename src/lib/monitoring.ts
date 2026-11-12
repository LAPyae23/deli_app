/** Error logging to MongoDB (best effort: never throws, never blocks long). */
import dbConnect from '@/lib/mongodb';
import ErrorLog from '@/models/ErrorLog';

export type ErrorEntry = {
  source: 'server' | 'client';
  route?: string;
  method?: string;
  message?: string;
  stack?: string;
  digest?: string;
  userAgent?: string;
};

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);

export async function logError(entry: ErrorEntry) {
  try {
    await dbConnect();
    await ErrorLog.create({
      source: entry.source,
      route: clip(entry.route, 300),
      method: clip(entry.method, 10),
      message: clip(entry.message, 1000),
      stack: clip(entry.stack, 4000),
      digest: clip(entry.digest, 100),
      userAgent: clip(entry.userAgent, 300),
    });
  } catch (e) {
    console.warn('Could not store error log:', e);
  }
}
