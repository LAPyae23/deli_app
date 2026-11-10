import mongoose from 'mongoose';
import MenuItem from '@/models/MenuItem';

const CATEGORIES = ['Fast Food', 'Burmese', 'Drinks', 'Dessert'] as const;
type OrderCategory = (typeof CATEGORIES)[number];

const MAX_LINES = 50;
const MAX_QUANTITY_PER_LINE = 50;

export function normalizeCategory(raw?: string): OrderCategory {
  if (!raw) return 'Fast Food';
  const match = CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
  if (match) return match;
  const lower = raw.toLowerCase();
  if (lower.includes('drink') || lower.includes('beverage')) return 'Drinks';
  if (lower.includes('dessert') || lower.includes('sweet')) return 'Dessert';
  if (lower.includes('burmese') || lower.includes('myanmar')) return 'Burmese';
  return 'Fast Food';
}

type MenuDoc = {
  _id: unknown;
  restaurantId: string;
  name: string;
  category?: string;
  price: number;
  discountPrice?: number | null;
  stockQuantity?: number;
  isAvailable?: boolean;
  addons?: Array<{ name: string; extraPrice: number }>;
  image?: string;
  imageAlt?: string;
};

export type ResolvedOrderLine = {
  /** MenuItem _id, used for stock deduction. */
  menuItemId: string;
  id: string;
  name: string;
  category: OrderCategory;
  price: number;
  unitPrice: number;
  quantity: number;
  options: string;
  restaurantName?: string;
  image?: string;
  imageAlt?: string;
  note?: string;
};

export type ResolveResult =
  | { ok: true; items: ResolvedOrderLine[]; restaurantId: string }
  | { ok: false; message: string };

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findMenuItem(
  rawId: string,
  name: string,
  restaurantHint: string
): Promise<MenuDoc | null> {
  const fields = 'restaurantId name category price discountPrice stockQuantity isAvailable addons image imageAlt';
  if (mongoose.Types.ObjectId.isValid(rawId)) {
    const byId = await MenuItem.findById(rawId).select(fields).lean<MenuDoc>();
    if (byId) return byId;
  }
  // Suggested items (e.g. `rec-…` ids) carry no MenuItem id — match by name.
  if (!name) return null;
  const filter: Record<string, unknown> = {
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
  };
  if (restaurantHint) filter.restaurantId = restaurantHint;
  return MenuItem.findOne(filter).select(fields).lean<MenuDoc>();
}

/**
 * Turn client cart lines into priced order lines using the database as the
 * source of truth for price, add-ons, stock and restaurant.
 */
export async function resolveOrderLines(
  rawItems: unknown,
  restaurantHint = ''
): Promise<ResolveResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, message: 'Your cart is empty' };
  }
  if (rawItems.length > MAX_LINES) {
    return { ok: false, message: 'Too many items in one order' };
  }

  const items: ResolvedOrderLine[] = [];
  const requestedPerItem = new Map<string, number>();
  let restaurantId = '';

  for (const raw of rawItems as Array<Record<string, unknown>>) {
    const lineId = String(raw?.id ?? '').trim();
    const [rawMenuId, addonPart = ''] = lineId.split('__');
    const clientName = String(raw?.name || '').trim();
    const quantity = Math.floor(Number(raw?.quantity) || 0);

    if (quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
      return { ok: false, message: `Invalid quantity for ${clientName || 'an item'}` };
    }

    const menu = await findMenuItem(rawMenuId, clientName, restaurantId || restaurantHint);
    if (!menu) {
      return { ok: false, message: `${clientName || 'An item'} is no longer on the menu` };
    }

    if (restaurantId && menu.restaurantId !== restaurantId) {
      return { ok: false, message: 'Please order from one restaurant at a time' };
    }
    restaurantId = menu.restaurantId;

    // Add-ons are encoded in the cart line id as "Name A, Name B".
    const addonNames = addonPart
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let addonsTotal = 0;
    for (const addonName of addonNames) {
      const addon = (menu.addons || []).find(
        (a) => a.name.toLowerCase() === addonName.toLowerCase()
      );
      if (!addon) {
        return { ok: false, message: `Add-on "${addonName}" is not available for ${menu.name}` };
      }
      addonsTotal += Math.max(0, Number(addon.extraPrice) || 0);
    }

    // The menu shows `price`; some suggestions show `discountPrice`. Accept the
    // client's figure only inside that range so it can never go below the menu.
    const basePrice = Math.max(0, Number(menu.price) || 0);
    const discountPrice = Number(menu.discountPrice);
    const lowestBase =
      Number.isFinite(discountPrice) && discountPrice > 0
        ? Math.min(basePrice, discountPrice)
        : basePrice;
    const floor = lowestBase + addonsTotal;
    const ceiling = basePrice + addonsTotal;
    const clientUnit = Number(raw?.unitPrice ?? raw?.price);
    const unitPrice = Math.round(
      Number.isFinite(clientUnit) ? Math.min(ceiling, Math.max(floor, clientUnit)) : ceiling
    );

    const menuItemId = String(menu._id);
    const totalRequested = (requestedPerItem.get(menuItemId) || 0) + quantity;
    requestedPerItem.set(menuItemId, totalRequested);
    const stock = Number(menu.stockQuantity) || 0;
    if (menu.isAvailable === false || stock <= 0) {
      return { ok: false, message: `${menu.name} is out of stock` };
    }
    if (stock < totalRequested) {
      return { ok: false, message: `Only ${stock} left of ${menu.name}` };
    }

    items.push({
      menuItemId,
      id: addonNames.length ? `${menuItemId}__${addonNames.join(', ')}` : menuItemId,
      name: menu.name,
      category: normalizeCategory(menu.category),
      price: unitPrice,
      unitPrice,
      quantity,
      options: addonNames.length ? addonNames.join(', ') : String(menu.category || ''),
      restaurantName: raw?.restaurantName ? String(raw.restaurantName) : undefined,
      image: menu.image || (raw?.image ? String(raw.image) : undefined),
      imageAlt: menu.imageAlt || (raw?.imageAlt ? String(raw.imageAlt) : undefined),
      note: raw?.note ? String(raw.note).slice(0, 300) : undefined,
    });
  }

  return { ok: true, items, restaurantId };
}
