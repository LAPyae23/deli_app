import { describe, expect, it } from 'vitest';
import { buildModel, evaluate, scoreDishes, similarity, type InteractionOrder } from '@/lib/recommender';
import { createSessionToken, resolveOwnId, verifySessionToken } from '@/lib/auth';

const order = (customerId: string, dishes: string[], day: number): InteractionOrder => ({
  customerId,
  createdAt: new Date(Date.UTC(2026, 9, day, 6)),
  items: dishes.map((name) => ({ name, category: name === 'Cola' ? 'Drinks' : 'Burmese', unitPrice: 1000 })),
});

describe('hybrid recommender', () => {
  // The worked example from the algorithms doc.
  const orders = [
    order('A', ['Mohinga'], 1),
    order('A', ['Mohinga', 'Fritters'], 2),
    order('B', ['Mohinga', 'Fritters', 'Cola'], 3),
    order('B', ['Cola'], 4),
    order('B', ['Cola'], 5),
    order('C', ['Cola'], 6),
    order('C', ['Cola'], 7),
  ];
  const model = buildModel(orders);

  it('cosine similarity over log(1+count) vectors', () => {
    expect(similarity(model, 'mohinga', 'fritters')).toBeCloseTo(0.975, 2);
    expect(similarity(model, 'mohinga', 'cola')).toBeCloseTo(0.42, 2);
  });

  it('scores are weighted sums in [0,1] and sorted', () => {
    const ranked = scoreDishes(model, 'A');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1].score);
    for (const d of ranked) {
      const sum = Object.values(d.contributions).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(d.score, 6);
      expect(d.score).toBeLessThanOrEqual(1);
    }
  });

  it('new customers get popularity only', () => {
    const ranked = scoreDishes(model, 'nobody');
    expect(ranked[0].name).toBe('Cola');
    expect(ranked.every((d) => d.contributions.collaborative === 0)).toBe(true);
  });

  it('evaluation hides each last order and reports three methods', () => {
    const r = evaluate(orders, { ks: [1, 3] });
    expect(r.customersEvaluated).toBe(3);
    expect(r.results.map((x) => x.name)).toEqual(['Hybrid (FoodDash)', 'Most popular', 'Random']);
  });
});

describe('auth', () => {
  it('signs and verifies a session; tampering fails', async () => {
    const token = await createSessionToken({ userId: 'u1', role: 'CUSTOMER' });
    expect(await verifySessionToken(token)).toEqual({ userId: 'u1', role: 'CUSTOMER' });
    expect(await verifySessionToken(token.slice(0, -2) + 'xx')).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it('resolveOwnId: non-admins only get their own id', () => {
    const me = { userId: 'me', role: 'CUSTOMER' as const };
    expect(resolveOwnId(me, undefined, 'CUSTOMER')).toBe('me');
    expect(resolveOwnId(me, 'me', 'CUSTOMER')).toBe('me');
    expect(resolveOwnId(me, 'someone-else', 'CUSTOMER')).toBeNull();
    expect(resolveOwnId(me, 'me', 'RIDER')).toBeNull();
    expect(resolveOwnId({ userId: 'a', role: 'ADMIN' }, 'x', 'CUSTOMER')).toBe('x');
  });
});
