import Order from '@/models/Order';
import { cacheGetOrSet } from '@/lib/ttlCache';
import { buildModel, type InteractionOrder, type RecommenderModel } from '@/lib/recommender';

const TTL_MS = 10 * 60_000;

/** Completed / in-progress orders from signed-in customers, trimmed to what the model needs. */
export function loadInteractions(): Promise<InteractionOrder[]> {
  return cacheGetOrSet('recommender:interactions', TTL_MS, async () => {
    const rows = await Order.find({
      status: { $nin: ['CANCELLED', 'REJECTED'] },
      customerId: { $nin: [null, '', 'guest'] },
    })
      .select('customerId createdAt restaurantId restaurantName totals.total totals.totalAmount items.name items.category items.unitPrice items.price items.quantity')
      .lean();

    return rows.map((r) => {
      const totals = (r.totals || {}) as { total?: number; totalAmount?: number };
      return {
        customerId: String(r.customerId),
        createdAt: r.createdAt as Date,
        restaurantId: r.restaurantId ? String(r.restaurantId) : undefined,
        restaurantName: r.restaurantName ? String(r.restaurantName) : undefined,
        total: Number(totals.total ?? totals.totalAmount) || 0,
        items: (r.items || []) as InteractionOrder['items'],
      };
    });
  });
}

export function loadModel(): Promise<RecommenderModel> {
  return cacheGetOrSet('recommender:model', TTL_MS, async () => buildModel(await loadInteractions()));
}
