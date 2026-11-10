import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { cacheGetOrSet } from '@/lib/ttlCache';
import { loadInteractions } from '@/lib/recommenderData';
import { WEIGHTS, evaluate } from '@/lib/recommender';

/**
 * GET /api/admin/recommender-eval
 * Offline accuracy of the For You recommender (leave-last-order-out Hit Rate@K)
 * compared with "most popular" and random baselines. Admin only (middleware).
 */
export async function GET() {
  try {
    await dbConnect();
    const payload = await cacheGetOrSet('recommender:eval', 10 * 60_000, async () => {
      const orders = await loadInteractions();
      return { ...evaluate(orders), weights: WEIGHTS, generatedAt: new Date().toISOString() };
    });
    return NextResponse.json({ success: true, ...payload });
  } catch (error) {
    console.error('Recommender eval error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to evaluate recommender' },
      { status: 500 }
    );
  }
}
