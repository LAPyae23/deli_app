import {
  linearRegression,
  linearRegressionLine,
  rSquared,
} from 'simple-statistics';

export type DateRangeKey = '7d' | '30d' | '90d' | 'all';

export type AnalyticsOrder = {
  _id?: string;
  customerName?: string;
  customerId?: string;
  distanceKm?: number;
  durationMins?: number;
  customerOrderCount?: number;
  createdAt?: string | Date;
  items?: Array<{ name?: string; category?: string; quantity?: number }>;
  status?: string;
};

export type PairStat = {
  pair: string;
  count: number;
  support: number;
  confidence: number;
  lift: number;
};

export type ChurnLabel = 'Safe' | 'At Risk' | 'Churned';

export type RegressionResult = {
  scatter: { distanceKm: number; durationMins: number }[];
  line: { distanceKm: number; predicted: number }[];
  slope: number;
  intercept: number;
  r2: number;
  mae: number;
  rmse: number;
  n: number;
};

export type ChurnResult = {
  slices: { name: ChurnLabel; value: number; color: string }[];
  totals: Record<ChurnLabel, number>;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    sampleSize: number;
  };
  confusion: Record<ChurnLabel, Record<ChurnLabel, number>>;
};

export const DATE_RANGE_OPTIONS: {
  key: DateRangeKey;
  label: string;
  days: number | null;
}[] = [
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '90d', label: 'Last 90 Days', days: 90 },
  { key: 'all', label: 'All Time', days: null },
];

export const CHURN_COLORS: Record<ChurnLabel, string> = {
  Safe: '#22c55e',
  'At Risk': '#f59e0b',
  Churned: '#ef4444',
};

const SCATTER_CAP = 500;

export function parseDateRange(raw: string | null | undefined): DateRangeKey {
  const value = String(raw || '').trim().toLowerCase();
  if (value === '7d' || value === '30d' || value === '90d' || value === 'all') {
    return value;
  }
  return '30d';
}

export function rangeCutoff(range: DateRangeKey, now = new Date()): Date | null {
  const option = DATE_RANGE_OPTIONS.find((o) => o.key === range);
  if (!option || option.days == null) return null;
  return new Date(now.getTime() - option.days * 24 * 60 * 60 * 1000);
}

function sampleEven<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = items.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) {
    out.push(items[Math.min(items.length - 1, Math.floor(i * step))]);
  }
  return out;
}

export function computeRegression(orders: AnalyticsOrder[]): RegressionResult {
  const points = orders
    .map((o) => {
      const x = Number(o.distanceKm);
      const y = Number(o.durationMins);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return null;
      return [x, y] as [number, number];
    })
    .filter((p): p is [number, number] => p != null);

  if (points.length < 2) {
    return {
      scatter: [],
      line: [],
      slope: 0,
      intercept: 0,
      r2: 0,
      mae: 0,
      rmse: 0,
      n: points.length,
    };
  }

  const model = linearRegression(points);
  const predict = linearRegressionLine(model);
  const r2 = rSquared(points, predict);

  let absErrSum = 0;
  let sqErrSum = 0;
  for (const [x, y] of points) {
    const err = y - predict(x);
    absErrSum += Math.abs(err);
    sqErrSum += err * err;
  }

  const xs = points.map((p) => p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  return {
    scatter: sampleEven(points, SCATTER_CAP).map(([distanceKm, durationMins]) => ({
      distanceKm,
      durationMins,
    })),
    line: [
      { distanceKm: minX, predicted: predict(minX) },
      { distanceKm: maxX, predicted: predict(maxX) },
    ],
    slope: model.m,
    intercept: model.b,
    r2,
    mae: absErrSum / points.length,
    rmse: Math.sqrt(sqErrSum / points.length),
    n: points.length,
  };
}

/**
 * Simplified Apriori for unordered item pairs.
 * support = P(A ∩ B), confidence = max(P(B|A), P(A|B)), lift = P(A∩B)/(P(A)P(B))
 */
export function computeMarketBasket(orders: AnalyticsOrder[], topN = 5): PairStat[] {
  const itemCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  let baskets = 0;

  for (const order of orders) {
    const names = Array.from(
      new Set(
        (order.items || [])
          .map((i) => String(i.name || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    if (names.length < 2) continue;
    baskets += 1;

    for (const name of names) {
      itemCounts.set(name, (itemCounts.get(name) || 0) + 1);
    }

    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const key = `${names[i]} + ${names[j]}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
  }

  if (baskets === 0) return [];

  return Array.from(pairCounts.entries())
    .map(([pair, count]) => {
      const [left, right] = pair.split(' + ');
      const countA = itemCounts.get(left) || 0;
      const countB = itemCounts.get(right) || 0;
      const support = count / baskets;
      const confAB = countA > 0 ? count / countA : 0;
      const confBA = countB > 0 ? count / countB : 0;
      const confidence = Math.max(confAB, confBA);
      const pA = countA / baskets;
      const pB = countB / baskets;
      const lift = pA > 0 && pB > 0 ? support / (pA * pB) : 0;
      return {
        pair,
        count,
        support: Math.round(support * 1000) / 10,
        confidence: Math.round(confidence * 1000) / 10,
        lift: Math.round(lift * 100) / 100,
      };
    })
    .sort((a, b) => b.count - a.count || b.lift - a.lift)
    .slice(0, topN);
}

function daysSince(date: Date, now = new Date()) {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function effectiveOrderCount(orderCount: number, maxReportedCount: number) {
  return Math.max(orderCount || 0, maxReportedCount || 0);
}

function predictChurnLabel(
  ageDays: number,
  orderCount: number,
  maxReportedCount: number
): ChurnLabel {
  const count = effectiveOrderCount(orderCount, maxReportedCount);
  const oneTimer = count <= 1;
  if (ageDays > 60 && oneTimer) return 'Churned';
  if (ageDays > 30 && oneTimer) return 'At Risk';
  if (ageDays > 45 && count <= 2) return 'At Risk';
  return 'Safe';
}

function emptyConfusion(): Record<ChurnLabel, Record<ChurnLabel, number>> {
  const zero = { Safe: 0, 'At Risk': 0, Churned: 0 };
  return {
    Safe: { ...zero },
    'At Risk': { ...zero },
    Churned: { ...zero },
  };
}

const LABEL_WINDOW_DAYS = 30;

export function computeChurn(orders: AnalyticsOrder[]): ChurnResult {
  type Agg = {
    orderCount: number;
    lastOrderAt: Date;
    maxReportedCount: number;
    obsCount: number;
    lastObsAt: Date | null;
    returnedInWindow: boolean;
  };

  const cutoff = new Date(Date.now() - LABEL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const byCustomer = new Map<string, Agg>();

  for (const order of orders) {
    const status = String(order.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'REJECTED') continue;

    const key =
      String(order.customerId || '').trim() ||
      String(order.customerName || '').trim() ||
      String(order._id || '');
    if (!key) continue;
    const created = order.createdAt ? new Date(order.createdAt) : new Date(0);
    const existing = byCustomer.get(key);
    const reported = Number(order.customerOrderCount) || 1;
    const inLabelWindow = created >= cutoff;

    if (!existing) {
      byCustomer.set(key, {
        orderCount: 1,
        lastOrderAt: created,
        maxReportedCount: reported,
        obsCount: inLabelWindow ? 0 : 1,
        lastObsAt: inLabelWindow ? null : created,
        returnedInWindow: inLabelWindow,
      });
    } else {
      existing.orderCount += 1;
      existing.maxReportedCount = Math.max(existing.maxReportedCount, reported);
      if (created > existing.lastOrderAt) existing.lastOrderAt = created;
      if (inLabelWindow) {
        existing.returnedInWindow = true;
      } else {
        existing.obsCount += 1;
        if (!existing.lastObsAt || created > existing.lastObsAt) {
          existing.lastObsAt = created;
        }
      }
    }
  }

  const totals: Record<ChurnLabel, number> = { Safe: 0, 'At Risk': 0, Churned: 0 };
  const confusion = emptyConfusion();
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let correct = 0;
  let evaluated = 0;

  for (const agg of byCustomer.values()) {
    const ageNow = daysSince(agg.lastOrderAt);
    const snapshot = predictChurnLabel(
      ageNow,
      agg.orderCount,
      agg.maxReportedCount
    );
    totals[snapshot] += 1;

    if (agg.obsCount <= 0 || !agg.lastObsAt) continue;

    evaluated += 1;
    const ageAtCutoff = daysSince(agg.lastObsAt, cutoff);
    const predicted = predictChurnLabel(
      ageAtCutoff,
      agg.obsCount,
      agg.maxReportedCount
    );
    const idleNow = daysSince(agg.lastOrderAt);
    let actual: ChurnLabel = 'Safe';
    if (!agg.returnedInWindow) {
      if (idleNow > 60) actual = 'Churned';
      else if (idleNow > 30) actual = 'At Risk';
    }

    confusion[actual][predicted] += 1;
    if (predicted === actual) correct += 1;

    const predPos = predicted === 'Churned';
    const actualPos = actual === 'Churned';
    if (predPos && actualPos) tp += 1;
    else if (predPos && !actualPos) fp += 1;
    else if (!predPos && actualPos) fn += 1;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const slices = (Object.keys(totals) as ChurnLabel[]).map((name) => ({
    name,
    value: totals[name],
    color: CHURN_COLORS[name],
  }));

  return {
    slices,
    totals,
    metrics: {
      accuracy: evaluated > 0 ? correct / evaluated : 0,
      precision,
      recall,
      f1,
      sampleSize: evaluated,
    },
    confusion,
  };
}
