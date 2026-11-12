import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import MenuItem from '@/models/MenuItem';
import RestaurantProfile from '@/models/RestaurantProfile';
import { getSession, unauthorized } from '@/lib/auth';
import { parseVoiceOrder, type MenuCandidate } from '@/lib/voiceOrder';

type Dish = {
  _id: unknown;
  name: string;
  restaurantId: string;
  price: number;
  discountPrice?: number;
  image?: string;
};

/**
 * POST /api/voice-order { text, restaurantId? }
 * Matches the sentence against available dishes. Without a restaurant it
 * picks the open restaurant that matches the most of the order.
 */
export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').slice(0, 500);
  if (!text.trim()) {
    return NextResponse.json({ success: false, message: 'Say or type what you want to order' }, { status: 400 });
  }
  await dbConnect();

  const open = await RestaurantProfile.find({ approvalStatus: 'APPROVED', storeStatus: { $ne: 'CLOSED' } })
    .select('restaurantId restaurantName')
    .lean<Array<{ restaurantId: string; restaurantName?: string }>>();
  const names = new Map(open.map((r) => [r.restaurantId, r.restaurantName || 'Restaurant']));
  const filter: Record<string, unknown> = { isAvailable: { $ne: false } };
  filter.restaurantId = body.restaurantId ? String(body.restaurantId) : { $in: [...names.keys()] };

  const dishes = await MenuItem.find(filter)
    .select('name restaurantId price discountPrice image')
    .limit(3000)
    .lean<Dish[]>();
  const byId = new Map(dishes.map((d) => [String(d._id), d]));

  // Score each restaurant by how much of the order it can cover.
  const groups = new Map<string, MenuCandidate[]>();
  for (const d of dishes) {
    const list = groups.get(d.restaurantId) || [];
    list.push({ id: String(d._id), name: d.name, restaurantId: d.restaurantId });
    groups.set(d.restaurantId, list);
  }
  let best: { restaurantId: string; result: ReturnType<typeof parseVoiceOrder> } | null = null;
  for (const [restaurantId, menu] of groups) {
    const result = parseVoiceOrder(text, menu);
    const covered = result.lines.length;
    if (!best || covered > best.result.lines.length) best = { restaurantId, result };
  }

  if (!best || best.result.lines.length === 0) {
    return NextResponse.json({
      success: true,
      restaurant: null,
      items: [],
      unmatched: text.split(/,|၊|\band\b|နဲ့/).map((s) => s.trim()).filter(Boolean),
      message: 'No matching dishes found. Try the dish name as it appears on the menu.',
    });
  }

  return NextResponse.json({
    success: true,
    restaurant: { id: best.restaurantId, name: names.get(best.restaurantId) || 'Restaurant' },
    items: best.result.lines.map((l) => {
      const d = byId.get(l.item.id)!;
      const unitPrice = Number(d.discountPrice) > 0 ? Math.min(d.price, Number(d.discountPrice)) : d.price;
      return { id: l.item.id, name: d.name, quantity: l.quantity, unitPrice, image: d.image || '', heard: l.heard };
    }),
    unmatched: best.result.unmatched,
  });
}
