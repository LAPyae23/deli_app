import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import {
  YANGON_TZ,
  hourLabel,
  startOfYangonDay,
  yangonParts,
  yangonWallToUtc,
} from '@/lib/yangonTime';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const gmvExpr = {
  $convert: {
    input: { $ifNull: ['$totals.total', { $ifNull: ['$totals.totalAmount', 0] }] },
    to: 'double',
    onError: 0,
    onNull: 0,
  },
};

type VolumeRange = 'today' | '7d' | '30d' | '90d' | 'all';

type BucketAgg = {
  _id?: string | number;
  orders?: number;
  gmv?: number;
};

const RELATIVE_DAYS: Record<Exclude<VolumeRange, 'today' | 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function isVolumeRange(value: string): value is VolumeRange {
  return (
    value === 'today' ||
    value === '7d' ||
    value === '30d' ||
    value === '90d' ||
    value === 'all'
  );
}

function roundGmv(value: number) {
  return Math.round(value * 100) / 100;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function enumerateYangonDays(from: Date, to: Date) {
  const start = startOfYangonDay(from);
  const end = startOfYangonDay(to);
  const out: Array<{ key: string; label: string }> = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
    const p = yangonParts(new Date(t));
    out.push({
      key: `${p.year}-${pad2(p.month)}-${pad2(p.day)}`,
      label: `${MONTH_LABELS[p.month - 1]} ${p.day}`,
    });
  }
  return out;
}

function enumerateYangonMonths(from: Date, to: Date) {
  const startP = yangonParts(from);
  const endP = yangonParts(to);
  const includeYear = startP.year !== endP.year;
  const out: Array<{ key: string; label: string }> = [];
  let year = startP.year;
  let month = startP.month;
  while (year < endP.year || (year === endP.year && month <= endP.month)) {
    out.push({
      key: `${year}-${pad2(month)}`,
      label: includeYear
        ? `${MONTH_LABELS[month - 1]} ${String(year).slice(2)}`
        : MONTH_LABELS[month - 1],
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const rawRange = searchParams.get('range') || 'today';
    if (!isVolumeRange(rawRange)) {
      return NextResponse.json(
        { success: false, message: 'Invalid range' },
        { status: 400 }
      );
    }

    const now = new Date();
    const parts = yangonParts(now);

    const liveStatus = { $nin: ['CANCELLED', 'REJECTED'] };
    let match: Record<string, unknown> = { createdAt: { $lte: now }, status: liveStatus };
    let groupId: unknown;
    let fill: Array<{ key: string | number; label: string }>;

    if (rawRange === 'today') {
      const matchStart = startOfYangonDay(now);
      match = { createdAt: { $gte: matchStart, $lte: now }, status: liveStatus };
      groupId = { $hour: { date: '$createdAt', timezone: YANGON_TZ } };
      fill = Array.from({ length: parts.hour + 1 }, (_, hour) => ({
        key: hour,
        label: hourLabel(hour),
      }));
    } else if (rawRange === '7d' || rawRange === '30d') {
      const cutoff = new Date(Date.now() - RELATIVE_DAYS[rawRange] * 24 * 60 * 60 * 1000);
      match = { createdAt: { $gte: cutoff, $lte: now }, status: liveStatus };
      groupId = {
        $dateToString: {
          format: '%Y-%m-%d',
          date: '$createdAt',
          timezone: YANGON_TZ,
        },
      };
      fill = enumerateYangonDays(cutoff, now);
    } else if (rawRange === '90d') {
      const cutoff = new Date(Date.now() - RELATIVE_DAYS[rawRange] * 24 * 60 * 60 * 1000);
      match = { createdAt: { $gte: cutoff, $lte: now }, status: liveStatus };
      groupId = {
        $dateToString: {
          format: '%Y-%m',
          date: '$createdAt',
          timezone: YANGON_TZ,
        },
      };
      fill = enumerateYangonMonths(cutoff, now);
    } else {
      groupId = {
        $dateToString: {
          format: '%Y-%m',
          date: '$createdAt',
          timezone: YANGON_TZ,
        },
      };
      fill = [];
    }

    const buckets = (await Order.aggregate(
      [
        { $match: match },
        {
          $group: {
            _id: groupId,
            orders: { $sum: 1 },
            gmv: { $sum: gmvExpr },
          },
        },
        { $sort: { _id: 1 } },
      ],
      { allowDiskUse: true }
    )) as BucketAgg[];

    const byKey = new Map<string, { orders: number; gmv: number }>();
    for (const row of buckets) {
      if (row._id == null) continue;
      byKey.set(String(row._id), {
        orders: Number(row.orders) || 0,
        gmv: Number(row.gmv) || 0,
      });
    }

    if (rawRange === 'all') {
      const keys = Array.from(byKey.keys()).sort();
      if (keys.length === 0) {
        fill = [];
      } else {
        const [startYear, startMonth] = keys[0].split('-').map(Number);
        const from = yangonWallToUtc(startYear, startMonth, 1);
        fill = enumerateYangonMonths(from, now);
      }
    }

    const points = fill.map(({ key, label }) => {
      const bucket = byKey.get(String(key));
      return {
        label,
        orders: bucket?.orders || 0,
        gmv: roundGmv(bucket?.gmv || 0),
      };
    });

    return NextResponse.json({
      success: true,
      range: rawRange,
      points,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Admin order-volume GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch order volume' },
      { status: 500 }
    );
  }
}
