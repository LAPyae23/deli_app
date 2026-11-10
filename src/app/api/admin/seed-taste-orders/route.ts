import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { getSession } from '@/lib/auth';
import { seedBulkOrders } from '../../../../../scripts/seed-bulk-orders';

// TEMPORARY one-off route: inserts 10k taste-based demo orders on the live
// database (which only Vercel can reach). Admin only. Remove after use.
export const maxDuration = 300;

export async function GET(request: Request) {
  const session = getSession(request);
  if (session?.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Admin only' }, { status: 403 });
  }
  await dbConnect();
  const existing = await Order.countDocuments({ orderNumber: /^#TASTE-/ });
  if (existing > 0) {
    return NextResponse.json({
      success: true,
      alreadySeeded: true,
      message: `Already done: ${existing.toLocaleString()} taste-based orders are in the database.`,
    });
  }
  try {
    const inserted = await seedBulkOrders({ ordersOnly: true, cli: false });
    const totalOrders = await Order.countDocuments();
    return NextResponse.json({
      success: true,
      inserted,
      totalOrders,
      message: `Done: added ${inserted.toLocaleString()} taste-based orders (${totalOrders.toLocaleString()} orders total).`,
    });
  } catch (error) {
    console.error('Taste seed failed:', error);
    return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
  }
}
