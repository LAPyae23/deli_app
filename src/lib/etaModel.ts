/**
 * Learned delivery-time (ETA) model.
 *
 * Fits a small linear regression on recent delivered orders:
 *   minutes ≈ b0 + b1·roadKm + b2·items + b3·peakHour + b4·rain
 * using ridge-regularised least squares (normal equations, solved with
 * Gaussian elimination). Refit at most once an hour. When there are too
 * few delivered orders, callers keep the rule-based estimate.
 */
import Order from '@/models/Order';
import { sharedGetOrSet } from '@/lib/sharedCache';
import { yangonMinuteOfDay } from '@/lib/schedule';

export const MIN_SAMPLES = 30;
const MAX_SAMPLES = 2000;
const RIDGE = 1;
export const FEATURES = ['intercept', 'roadKm', 'items', 'peakHour', 'rain'] as const;

export type EtaModel = {
  ready: boolean;
  samples: number;
  coefficients: number[];
  /** Mean absolute error on the training rows (minutes). */
  maeMinutes: number | null;
  /** Same error for the old rule (prep + travel) on the same rows, for comparison. */
  ruleMaeMinutes: number | null;
  trainedAt: string;
};

/** Lunch 11–13 and dinner 17–20, Yangon time. */
export function isPeakHour(hour: number) {
  return (hour >= 11 && hour < 14) || (hour >= 17 && hour < 21);
}

export function featureRow(input: { roadKm: number; items: number; hour: number; wet: boolean }) {
  return [1, input.roadKm, Math.min(20, input.items), isPeakHour(input.hour) ? 1 : 0, input.wet ? 1 : 0];
}

/** Solves A·x = b (A is n×n) by Gaussian elimination with partial pivoting. */
export function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-9) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Ridge regression: (XᵀX + λI)β = Xᵀy (intercept not penalised). */
export function fitRidge(X: number[][], y: number[], lambda = RIDGE): number[] | null {
  const k = X[0]?.length || 0;
  const XtX = Array.from({ length: k }, () => Array(k).fill(0) as number[]);
  const Xty = Array(k).fill(0) as number[];
  X.forEach((row, i) => {
    for (let a = 0; a < k; a++) {
      Xty[a] += row[a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += row[a] * row[b];
    }
  });
  for (let a = 1; a < k; a++) XtX[a][a] += lambda;
  return solve(XtX, Xty);
}

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

async function train(): Promise<EtaModel> {
  const rows = await Order.find({
    status: 'DELIVERED',
    completedAt: { $ne: null },
    $or: [{ scheduledFor: null }, { scheduledFor: { $exists: false } }],
  })
    .select('createdAt completedAt distanceKm items.quantity weather prepTime travelMins')
    .sort({ completedAt: -1 })
    .limit(MAX_SAMPLES)
    .lean<
      Array<{
        createdAt: Date;
        completedAt: Date;
        distanceKm?: number;
        items?: Array<{ quantity?: number }>;
        weather?: string;
        prepTime?: number;
        travelMins?: number;
      }>
    >();

  const X: number[][] = [];
  const y: number[] = [];
  const rule: number[] = [];
  for (const r of rows) {
    const minutes = (new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()) / 60000;
    if (!Number.isFinite(minutes) || minutes < 8 || minutes > 180) continue;
    const hour = Math.floor(yangonMinuteOfDay(new Date(r.createdAt)) / 60);
    const items = (r.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    X.push(featureRow({ roadKm: Number(r.distanceKm) || 3.5, items, hour, wet: r.weather === 'Rainy' || r.weather === 'Stormy' }));
    y.push(minutes);
    rule.push((Number(r.prepTime) || 15) + (Number(r.travelMins) || 15));
  }

  const base = { samples: y.length, trainedAt: new Date().toISOString() };
  if (y.length < MIN_SAMPLES) {
    return { ready: false, coefficients: [], maeMinutes: null, ruleMaeMinutes: null, ...base };
  }
  const beta = fitRidge(X, y);
  if (!beta || beta.some((b) => !Number.isFinite(b))) {
    return { ready: false, coefficients: [], maeMinutes: null, ruleMaeMinutes: null, ...base };
  }
  const mae = y.reduce((s, v, i) => s + Math.abs(v - dot(beta, X[i])), 0) / y.length;
  const ruleMae = y.reduce((s, v, i) => s + Math.abs(v - rule[i]), 0) / y.length;
  return {
    ready: true,
    coefficients: beta.map((b) => Math.round(b * 1000) / 1000),
    maeMinutes: Math.round(mae * 10) / 10,
    ruleMaeMinutes: Math.round(ruleMae * 10) / 10,
    ...base,
  };
}

export function getEtaModel() {
  return sharedGetOrSet<EtaModel>('eta-model:v1', 3600_000, train);
}

/** Learned minutes for a new order, or null when the model is not ready. */
export async function predictMinutes(input: { roadKm: number; items: number; hour: number; wet: boolean }) {
  const model = await getEtaModel().catch(() => null);
  if (!model?.ready) return null;
  const minutes = dot(model.coefficients, featureRow(input));
  return Number.isFinite(minutes) ? Math.min(120, Math.max(10, Math.round(minutes))) : null;
}

export async function etaModelInfo() {
  const m = await getEtaModel();
  return { ...m, features: FEATURES };
}
