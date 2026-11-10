import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { syncOrderWeather } from '@/lib/weatherSync';

/**
 * GET /api/cron/weather-sync — run daily by Vercel Cron (vercel.json).
 * Labels orders that lack real weather with Open-Meteo history. Idempotent
 * and cheap once everything is synced. If CRON_SECRET is set, Vercel sends
 * it as a Bearer token and anything else is refused.
 */
export const maxDuration = 300;

let running: Promise<unknown> | null = null;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    await dbConnect();
    // Never run two syncs at once on the same instance.
    running ??= syncOrderWeather().finally(() => {
      running = null;
    });
    const result = await running;
    return NextResponse.json({ success: true, ...(result as object) });
  } catch (error) {
    console.error('Weather sync failed:', error);
    return NextResponse.json({ success: false, message: 'Weather sync failed' }, { status: 500 });
  }
}
