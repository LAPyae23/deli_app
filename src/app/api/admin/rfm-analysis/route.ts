import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

type RfmSegment = 'Top VIP' | 'Sleeping Beauty' | 'New/Normal';

type LeanOrder = {
  customerId?: string;
  customerName?: string;
  createdAt?: Date;
  status?: string;
  totals?: { total?: number; totalAmount?: number } | null;
  totalAmount?: number;
};

type CustomerAgg = {
  customerId: string;
  customerName: string;
  orderCount: number;
  monetary: number;
  lastOrderAt: Date;
};

function orderMonetary(order: LeanOrder): number {
  const fromTotals = Number(order.totals?.total ?? order.totals?.totalAmount);
  if (Number.isFinite(fromTotals) && fromTotals > 0) return fromTotals;
  const direct = Number(order.totalAmount);
  return Number.isFinite(direct) && direct > 0 ? direct : 0;
}

function daysSince(date: Date, now = new Date()): number {
  const ms = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const orders = (await Order.find({})
      .select('customerId customerName createdAt status totals')
      .lean()) as LeanOrder[];

    const byCustomer = new Map<string, CustomerAgg>();

    for (const order of orders) {
      const status = String(order.status || '').toUpperCase();
      if (status === 'CANCELLED' || status === 'REJECTED') continue;

      const customerId = String(order.customerId || '').trim();
      const customerName = String(order.customerName || 'Customer').trim() || 'Customer';
      const key = customerId || `name:${customerName.toLowerCase()}`;
      const created = order.createdAt ? new Date(order.createdAt) : now;
      const amount = orderMonetary(order);

      const existing = byCustomer.get(key);
      if (!existing) {
        byCustomer.set(key, {
          customerId: customerId || key,
          customerName,
          orderCount: 1,
          monetary: amount,
          lastOrderAt: created,
        });
      } else {
        existing.orderCount += 1;
        existing.monetary += amount;
        if (created > existing.lastOrderAt) {
          existing.lastOrderAt = created;
          existing.customerName = customerName || existing.customerName;
        }
      }
    }

    const customers = Array.from(byCustomer.values());
    if (customers.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalCustomers: 0,
          segments: [
            { name: 'Top VIP', value: 0, percentage: 0 },
            { name: 'Sleeping Beauty', value: 0, percentage: 0 },
            { name: 'New/Normal', value: 0, percentage: 0 },
          ],
        },
        customers: [],
        sleepingBeauties: [],
        thresholds: null,
        generatedAt: now.toISOString(),
      });
    }

    const frequencies = customers.map((c) => c.orderCount).sort((a, b) => a - b);
    const monetaries = customers.map((c) => c.monetary).sort((a, b) => a - b);
    const recencies = customers
      .map((c) => daysSince(c.lastOrderAt, now))
      .sort((a, b) => a - b);

    // High F / High M ≈ top half; Low R ≈ fresher than median; High R ≈ older than ~60th pct
    const highF = Math.max(2, percentile(frequencies, 0.55));
    const highM = Math.max(1, percentile(monetaries, 0.55));
    const lowR = percentile(recencies, 0.45);
    const highR = Math.max(lowR + 1, percentile(recencies, 0.6));

    const scored = customers.map((c) => {
      const recencyDays = daysSince(c.lastOrderAt, now);
      const frequency = c.orderCount;
      const monetary = Math.round(c.monetary * 100) / 100;
      const isHighF = frequency >= highF;
      const isHighM = monetary >= highM;
      const isLowR = recencyDays <= lowR;
      const isHighR = recencyDays >= highR;

      let segment: RfmSegment = 'New/Normal';
      if (isHighF && isHighM && isLowR) {
        segment = 'Top VIP';
      } else if ((isHighM || isHighF) && isHighR) {
        segment = 'Sleeping Beauty';
      }

      return {
        customerId: c.customerId,
        customerName: c.customerName,
        recencyDays,
        frequency,
        monetary,
        lastOrderAt: c.lastOrderAt.toISOString(),
        segment,
      };
    });

    scored.sort((a, b) => {
      const rank = { 'Top VIP': 0, 'Sleeping Beauty': 1, 'New/Normal': 2 };
      const segDiff = rank[a.segment] - rank[b.segment];
      if (segDiff !== 0) return segDiff;
      return b.monetary - a.monetary;
    });

    const counts = {
      'Top VIP': 0,
      'Sleeping Beauty': 0,
      'New/Normal': 0,
    } as Record<RfmSegment, number>;

    for (const row of scored) counts[row.segment] += 1;

    const totalCustomers = scored.length;
    const segments = (Object.keys(counts) as RfmSegment[]).map((name) => ({
      name,
      value: counts[name],
      percentage:
        totalCustomers > 0
          ? Math.round((counts[name] / totalCustomers) * 1000) / 10
          : 0,
    }));

    const sleepingBeauties = scored.filter((c) => c.segment === 'Sleeping Beauty');

    return NextResponse.json({
      success: true,
      summary: {
        totalCustomers,
        segments,
      },
      customers: scored,
      sleepingBeauties,
      thresholds: {
        highFrequency: highF,
        highMonetary: Math.round(highM * 100) / 100,
        lowRecencyDays: Math.round(lowR * 10) / 10,
        highRecencyDays: Math.round(highR * 10) / 10,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Admin RFM analysis GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to run RFM analysis' },
      { status: 500 }
    );
  }
}
