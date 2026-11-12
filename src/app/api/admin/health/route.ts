import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ErrorLog from '@/models/ErrorLog';
import Order from '@/models/Order';
import { getYangonWeather } from '@/lib/weather';
import { cacheInfo } from '@/lib/sharedCache';
import { etaModelInfo } from '@/lib/etaModel';

export const dynamic = 'force-dynamic';

/** GET /api/admin/health — database, weather feed, cache, ETA model and recent errors. */
export async function GET() {
  const t0 = Date.now();
  await dbConnect();
  await mongoose.connection.db?.admin().ping();
  const dbLatencyMs = Date.now() - t0;

  const since = new Date(Date.now() - 24 * 3600_000);
  const [errors24h, recent, ordersLastHour, weather, eta] = await Promise.all([
    ErrorLog.aggregate<{ _id: string; n: number }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$source', n: { $sum: 1 } } },
    ]),
    ErrorLog.find().sort({ createdAt: -1 }).limit(30).select('source route method message createdAt').lean(),
    Order.countDocuments({ createdAt: { $gte: new Date(Date.now() - 3600_000) } }),
    getYangonWeather().catch(() => null),
    etaModelInfo().catch(() => null),
  ]);

  return NextResponse.json({
    success: true,
    database: { ok: true, latencyMs: dbLatencyMs },
    weather: weather ? { source: weather.source, now: weather.now.kind } : { source: 'unavailable' },
    cache: cacheInfo(),
    routing: {
      osrm: process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org (public)',
      nominatim: process.env.NEXT_PUBLIC_NOMINATIM_URL || 'https://nominatim.openstreetmap.org (public)',
    },
    eta,
    ordersLastHour,
    errors24h: Object.fromEntries(errors24h.map((e) => [e._id, e.n])),
    recentErrors: recent,
    runtime: {
      region: process.env.VERCEL_REGION || 'local',
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
      uptimeSec: Math.round(process.uptime()),
    },
  });
}
