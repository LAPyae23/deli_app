import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — public uptime check (for an uptime monitor such as
 * UptimeRobot). Returns 200 when the database answers, 503 otherwise.
 */
export async function GET() {
  const started = Date.now();
  try {
    await dbConnect();
    await mongoose.connection.db?.admin().ping();
    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      dbLatencyMs: Date.now() - started,
      uptimeSec: Math.round(process.uptime()),
      region: process.env.VERCEL_REGION || 'local',
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable', time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
