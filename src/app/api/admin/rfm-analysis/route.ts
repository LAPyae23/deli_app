import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';

type RfmSegment = 'Top VIP' | 'Sleeping Beauty' | 'New/Normal';

type CustomerAgg = {
  _id?: string;
  customerId?: string;
  customerName?: string;
  orderCount?: number;
  monetary?: number;
  lastOrderAt?: Date | string;
};

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

const gmvExpr = {
  $convert: {
    input: { $ifNull: ['$totals.total', { $ifNull: ['$totals.totalAmount', '$totalAmount'] }] },
    to: 'double',
    onError: 0,
    onNull: 0,
  },
};

export async function GET() {
  try {
    await dbConnect();

    const payload = await cacheGetOrSet('rfm-analysis', 60_000, async () => {
    const now = new Date();
    const customers = (await Order.aggregate(
      [
        {
          $match: {
            status: { $nin: ['CANCELLED', 'REJECTED'] },
          },
        },
        {
          $addFields: {
            amount: gmvExpr,
            customerKey: {
              $let: {
                vars: {
                  cid: {
                    $trim: {
                      input: { $toString: { $ifNull: ['$customerId', ''] } },
                    },
                  },
                  cname: {
                    $trim: {
                      input: { $ifNull: ['$customerName', 'Customer'] },
                    },
                  },
                },
                in: {
                  $cond: [
                    { $gt: [{ $strLenCP: '$$cid' }, 0] },
                    '$$cid',
                    {
                      $concat: [
                        'name:',
                        { $toLower: { $ifNull: ['$$cname', 'Customer'] } },
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: '$customerKey',
            customerId: { $first: { $ifNull: ['$customerId', ''] } },
            customerName: {
              $top: {
                sortBy: { createdAt: -1 },
                output: { $ifNull: ['$customerName', 'Customer'] },
              },
            },
            orderCount: { $sum: 1 },
            monetary: { $sum: '$amount' },
            lastOrderAt: { $max: '$createdAt' },
          },
        },
      ],
      { allowDiskUse: true }
    )) as CustomerAgg[];

    if (customers.length === 0) {
      return {
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
        topVips: [],
        sleepingBeauties: [],
        newNormals: [],
        thresholds: null,
        generatedAt: now.toISOString(),
      };
    }

    const normalized = customers.map((c) => {
      const lastOrderAt = c.lastOrderAt ? new Date(c.lastOrderAt) : now;
      return {
        customerId: String(c.customerId || c._id || ''),
        customerName: String(c.customerName || 'Customer').trim() || 'Customer',
        orderCount: Number(c.orderCount) || 0,
        monetary: Number(c.monetary) || 0,
        lastOrderAt: Number.isNaN(lastOrderAt.getTime()) ? now : lastOrderAt,
      };
    });

    const frequencies = normalized.map((c) => c.orderCount).sort((a, b) => a - b);
    const monetaries = normalized.map((c) => c.monetary).sort((a, b) => a - b);
    const recencies = normalized
      .map((c) => daysSince(c.lastOrderAt, now))
      .sort((a, b) => a - b);

    const highF = Math.max(2, percentile(frequencies, 0.55));
    const highM = Math.max(1, percentile(monetaries, 0.55));
    const lowR = percentile(recencies, 0.45);
    const highR = Math.max(lowR + 1, percentile(recencies, 0.6));

    const scored = normalized.map((c) => {
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
    const topVips = scored.filter((c) => c.segment === 'Top VIP');
    const newNormals = scored.filter((c) => c.segment === 'New/Normal');

    return {
      success: true,
      summary: {
        totalCustomers,
        segments,
      },
      customers: scored,
      topVips,
      sleepingBeauties,
      newNormals,
      thresholds: {
        highFrequency: highF,
        highMonetary: Math.round(highM * 100) / 100,
        lowRecencyDays: Math.round(lowR * 10) / 10,
        highRecencyDays: Math.round(highR * 10) / 10,
      },
      generatedAt: now.toISOString(),
    };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Admin RFM analysis GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to run RFM analysis' },
      { status: 500 }
    );
  }
}
