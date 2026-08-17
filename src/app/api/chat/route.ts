import { openai } from '@ai-sdk/openai';
import {
  convertToModelMessages,
  streamText,
  type ModelMessage,
  type UIMessage,
} from 'ai';
import dbConnect from '@/lib/mongodb';
import RestaurantProfile from '@/models/RestaurantProfile';
import MenuItem from '@/models/MenuItem';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_RESTAURANTS = 50;
const MAX_ITEMS_PER_RESTAURANT = 8;
const MAX_CATALOG_CHARS = 14_000;

type LeanRestaurant = {
  restaurantId?: string;
  restaurantName?: string;
  township?: string;
  storeStatus?: string;
  description?: string;
};

type LeanMenuItem = {
  restaurantId?: string;
  name?: string;
  price?: number;
  description?: string;
  category?: string;
};

function isUiMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.role != null && Array.isArray(row.parts);
}

async function toModelMessages(raw: unknown): Promise<ModelMessage[]> {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if (raw.some(isUiMessage)) {
    return convertToModelMessages(raw as UIMessage[]);
  }

  const converted: ModelMessage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const role = String(row.role || '');
    if (role !== 'user' && role !== 'assistant' && role !== 'system') continue;
    const content =
      typeof row.content === 'string'
        ? row.content
        : row.content != null
          ? JSON.stringify(row.content)
          : '';
    if (!content.trim()) continue;
    converted.push({ role, content } as ModelMessage);
  }
  return converted;
}

async function loadMenuCatalog(): Promise<string> {
  const restaurants = (await RestaurantProfile.find({
    approvalStatus: { $ne: 'REJECTED' },
  })
    .select('restaurantId restaurantName township storeStatus description')
    .limit(MAX_RESTAURANTS)
    .lean()) as LeanRestaurant[];

  if (restaurants.length === 0) {
    return '(No restaurants are currently listed in FoodDash.)';
  }

  const restaurantIds = restaurants
    .map((r) => String(r.restaurantId || ''))
    .filter(Boolean);

  const menuItems = (await MenuItem.find({
    restaurantId: { $in: restaurantIds },
    isAvailable: { $ne: false },
  })
    .select('restaurantId name price description category')
    .lean()) as LeanMenuItem[];

  const itemsByRestaurant = new Map<string, LeanMenuItem[]>();
  for (const item of menuItems) {
    const id = String(item.restaurantId || '');
    if (!id) continue;
    const list = itemsByRestaurant.get(id) || [];
    if (list.length < MAX_ITEMS_PER_RESTAURANT) list.push(item);
    itemsByRestaurant.set(id, list);
  }

  const lines: string[] = [];
  for (const restaurant of restaurants) {
    const name = String(restaurant.restaurantName || 'Restaurant').trim();
    const township = String(restaurant.township || '').trim();
    const status = String(restaurant.storeStatus || 'OPEN');
    const header = township
      ? `${name} (${township}, ${status})`
      : `${name} (${status})`;
    const items = itemsByRestaurant.get(String(restaurant.restaurantId || '')) || [];
    if (items.length === 0) {
      lines.push(`- ${header}: no available menu items listed.`);
      continue;
    }
    const dishes = items
      .map((item) => {
        const dish = String(item.name || 'Item');
        const price = Number(item.price);
        const priceLabel = Number.isFinite(price) ? `${Math.round(price)} Ks` : 'price n/a';
        const desc = String(item.description || '').replace(/\s+/g, ' ').trim();
        return desc ? `${dish} (${priceLabel}) — ${desc}` : `${dish} (${priceLabel})`;
      })
      .join('; ');
    lines.push(`- ${header}: ${dishes}`);
  }

  let catalog = lines.join('\n');
  if (catalog.length > MAX_CATALOG_CHARS) {
    catalog = `${catalog.slice(0, MAX_CATALOG_CHARS)}\n- (catalog truncated)`;
  }
  return catalog;
}

function buildSystemPrompt(catalog: string) {
  return `You are FoodDash Assistant, a helpful food-delivery concierge for the FoodDash app in Yangon, Myanmar.

You MUST only recommend restaurants and menu items that appear in the LIVE MENU CONTEXT below. Do not invent, guess, or mention restaurants, dishes, or prices that are not in this context. If the user asks for something that is not listed, say you cannot find it on FoodDash and suggest the closest matching items from the context.

When you recommend food:
- Name the restaurant exactly as listed
- Name the dish exactly as listed
- Include the listed price in Ks
- Mention township when it is available
- Keep answers concise and friendly

LIVE MENU CONTEXT (from the FoodDash MongoDB catalog):
${catalog}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const incoming =
      Array.isArray(body?.messages) && body.messages.length > 0
        ? body.messages
        : body?.message
          ? [{ role: 'user', content: String(body.message) }]
          : [];

    const messages = await toModelMessages(incoming);
    if (messages.length === 0) {
      return Response.json(
        { success: false, message: 'messages is required' },
        { status: 400 }
      );
    }

    let catalog = '(Menu catalog unavailable.)';
    try {
      await dbConnect();
      catalog = await loadMenuCatalog();
    } catch (catalogError) {
      console.error('FoodDash chat catalog error:', catalogError);
    }

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: buildSystemPrompt(catalog),
      messages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('FoodDash chat POST error:', error);
    return Response.json(
      { success: false, message: 'Failed to generate chat response' },
      { status: 500 }
    );
  }
}
