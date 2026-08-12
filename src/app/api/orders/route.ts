import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import MenuItem from '@/models/MenuItem';
import RestaurantProfile from '@/models/RestaurantProfile';

const FALLBACK_COORDS = { lat: 16.8409, lng: 96.1735 };

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const restaurantName = searchParams.get('restaurantName');
    const restaurantId = searchParams.get('restaurantId');
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const riderId = searchParams.get('riderId');
    const unassigned = searchParams.get('unassigned');

    const query: Record<string, unknown> = {};
    if (restaurantName) query.restaurantName = restaurantName;
    if (restaurantId) query.restaurantId = restaurantId;
    if (customerId) query.customerId = customerId;

    if (status) {
      const statuses = status
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (statuses.length === 1) {
        query.status = statuses[0];
      } else if (statuses.length > 1) {
        query.status = { $in: statuses };
      }
    }

    if (riderId) {
      query.riderId = riderId;
    }

    if (unassigned === 'true' || unassigned === '1') {
      query.$or = [
        { riderId: { $exists: false } },
        { riderId: null },
        { riderId: '' },
      ];
    }

    // Offline riders must not receive dispatch candidates
    const forRiderId = searchParams.get('forRiderId')?.trim() || '';
    if (forRiderId) {
      const RiderProfile = (await import('@/models/RiderProfile')).default;
      const rider = await RiderProfile.findOne({ riderId: forRiderId })
        .select('status')
        .lean();
      if (!rider || String(rider.status) !== 'Online') {
        return NextResponse.json({ success: true, orders: [] });
      }
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    if (!body?.items?.length || !body?.deliveryAddress?.address) {
      return NextResponse.json(
        { success: false, message: 'Invalid order data' },
        { status: 400 }
      );
    }

    // Block orders to CLOSED / BUSY restaurants
    if (body.restaurantId) {
      const restaurantProfile = await RestaurantProfile.findOne({
        restaurantId: String(body.restaurantId),
      })
        .select('storeStatus restaurantName')
        .lean();
      const storeStatus = String(restaurantProfile?.storeStatus || 'OPEN').toUpperCase();
      if (storeStatus === 'CLOSED') {
        return NextResponse.json(
          { success: false, message: 'This restaurant is closed and cannot accept orders' },
          { status: 400 }
        );
      }
      if (storeStatus === 'BUSY') {
        return NextResponse.json(
          {
            success: false,
            message: 'This restaurant is temporarily unavailable',
          },
          { status: 400 }
        );
      }
    }

    // Validate stock before creating the order
    const cartLines = (Array.isArray(body.items) ? body.items : []) as Array<{
      id?: string;
      name?: string;
      quantity?: number;
    }>;
    for (const line of cartLines) {
      const menuItemId = String(line.id || '').split('__')[0];
      const quantity = Number(line.quantity) || 1;
      if (!menuItemId || quantity <= 0) continue;

      const menuItem = await MenuItem.findById(menuItemId)
        .select('name stockQuantity isAvailable')
        .lean();
      if (!menuItem) continue;

      if (!menuItem.isAvailable || Number(menuItem.stockQuantity) <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: `${menuItem.name || 'Item'} is out of stock`,
          },
          { status: 400 }
        );
      }
      if (Number(menuItem.stockQuantity) < quantity) {
        return NextResponse.json(
          {
            success: false,
            message: `Only ${menuItem.stockQuantity} left of ${menuItem.name}`,
          },
          { status: 400 }
        );
      }
    }

    const CATEGORIES = ['Fast Food', 'Burmese', 'Drinks', 'Dessert'] as const;
    type OrderCategory = (typeof CATEGORIES)[number];

    function normalizeCategory(raw?: string): OrderCategory {
      if (!raw) return 'Fast Food';
      const match = CATEGORIES.find(
        (c) => c.toLowerCase() === raw.toLowerCase()
      );
      if (match) return match;
      const lower = raw.toLowerCase();
      if (lower.includes('drink') || lower.includes('beverage')) return 'Drinks';
      if (lower.includes('dessert') || lower.includes('sweet')) return 'Dessert';
      if (lower.includes('burmese') || lower.includes('myanmar')) return 'Burmese';
      return 'Fast Food';
    }

    const rawItems = body.items as Array<Record<string, unknown>>;
    const items = await Promise.all(
      rawItems.map(async (item) => {
        const unitPrice = Number(item.unitPrice ?? item.price) || 0;
        let category = normalizeCategory(
          typeof item.category === 'string' ? item.category : undefined
        );

        // Try to resolve category from MenuItem when not provided
        if (!item.category) {
          const menuItemId = String(item.id || '').split('__')[0];
          if (menuItemId) {
            try {
              const menuDoc = await MenuItem.findById(menuItemId)
                .select('category')
                .lean();
              if (menuDoc?.category) {
                category = normalizeCategory(String(menuDoc.category));
              }
            } catch {
              // keep default category
            }
          }
        }

        return {
          id: String(item.id ?? ''),
          name: String(item.name || 'Item'),
          category,
          price: unitPrice,
          quantity: Number(item.quantity) || 1,
          options: String(item.options ?? ''),
          unitPrice,
          restaurantName: item.restaurantName
            ? String(item.restaurantName)
            : undefined,
          image: item.image ? String(item.image) : undefined,
          imageAlt: item.imageAlt ? String(item.imageAlt) : undefined,
          note: item.note ? String(item.note) : undefined,
        };
      })
    );

    const orderNumber = `#FP-${Math.floor(1000 + Math.random() * 9000)}`;
    const restaurantName =
      body.restaurantName || items[0]?.restaurantName || 'Burger Bliss';
    const restaurantId = body.restaurantId || '';

    let restaurantCoords = { ...FALLBACK_COORDS };
    try {
      const profileQuery = restaurantId ? { restaurantId } : { restaurantName };
      const profile = await RestaurantProfile.findOne(profileQuery).lean();
      const lat = Number(profile?.location?.lat);
      const lng = Number(profile?.location?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        restaurantCoords = { lat, lng };
      } else if (!restaurantId && restaurantName) {
        const byName = await RestaurantProfile.findOne({
          restaurantName: new RegExp(
            `^${restaurantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
        }).lean();
        const nLat = Number(byName?.location?.lat);
        const nLng = Number(byName?.location?.lng);
        if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
          restaurantCoords = { lat: nLat, lng: nLng };
        }
      }
    } catch (lookupError) {
      console.warn('Restaurant coords lookup failed, using fallback:', lookupError);
    }

    const weatherOptions = ['Sunny', 'Rainy', 'Cloudy', 'Stormy'] as const;
    const randomWeather =
      weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    const discount =
      body.discount != null && Number.isFinite(Number(body.discount))
        ? Number(body.discount)
        : Math.round(Math.random() * 2000); // 0–2000 MMK simulated promo

    const surgePrice =
      body.surgePrice != null && Number.isFinite(Number(body.surgePrice))
        ? Number(body.surgePrice)
        : Math.random() < 0.35
          ? Math.round(500 + Math.random() * 1500)
          : 0;

    const weather =
      typeof body.weather === 'string' &&
      weatherOptions.includes(body.weather as (typeof weatherOptions)[number])
        ? body.weather
        : randomWeather;

    const cancelReason =
      typeof body.cancelReason === 'string' ? body.cancelReason : '';

    const prepTime =
      body.prepTime != null && Number.isFinite(Number(body.prepTime))
        ? Number(body.prepTime)
        : Math.floor(Math.random() * 25 + 12); // 12–36 mins simulated kitchen time

    const travelMins =
      body.travelMins != null && Number.isFinite(Number(body.travelMins))
        ? Number(body.travelMins)
        : Math.floor(Math.random() * 25 + 10); // 10–34 mins simulated rider travel

    const durationMins =
      body.durationMins != null && Number.isFinite(Number(body.durationMins))
        ? Number(body.durationMins)
        : prepTime + travelMins;

    const newOrder = await Order.create({
      orderNumber,
      restaurantName,
      restaurantId,
      customerId: body.customerId || 'guest',
      customerName: body.customerName || body.deliveryAddress?.label || 'Customer',
      status: 'PENDING',
      items,
      totals: body.totals,
      deliveryAddress: body.deliveryAddress,
      paymentMethod: body.paymentMethod || 'card',
      restaurantCoords,
      discount,
      surgePrice,
      weather,
      cancelReason,
      prepTime,
      travelMins,
      durationMins,
    });

    // Auto-deduct menu stock for each ordered item
    for (const item of body.items as Array<{ id?: string; quantity?: number }>) {
      // Cart line ids may be `${menuItemId}__${addons}` — use the MenuItem _id only
      const menuItemId = String(item.id || '').split('__')[0];
      const quantity = Number(item.quantity) || 1;

      if (!menuItemId || quantity <= 0) continue;

      try {
        const updatedItem = await MenuItem.findOneAndUpdate(
          {
            _id: menuItemId,
            stockQuantity: { $gte: quantity },
          },
          { $inc: { stockQuantity: -quantity } },
          { new: true }
        );

        if (!updatedItem) {
          // Race: stock ran out between validate and deduct — clamp availability
          await MenuItem.findByIdAndUpdate(menuItemId, {
            $set: { stockQuantity: 0, isAvailable: false },
          });
          continue;
        }

        if (updatedItem.stockQuantity <= 0) {
          updatedItem.stockQuantity = 0;
          updatedItem.isAvailable = false;
          await updatedItem.save();
        }
      } catch (stockError) {
        console.warn(`Stock deduction failed for menu item ${menuItemId}:`, stockError);
      }
    }

    return NextResponse.json({
      success: true,
      orderId: String(newOrder._id),
      orderNumber: newOrder.orderNumber,
      estimatedDeliveryMinutes: 30,
      message: 'Order placed successfully',
    });

  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save order' },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  // Status updates belong on the dynamic route
  return NextResponse.json(
    { success: false, message: 'Use dynamic route /api/orders/[id] for PATCH' },
    { status: 400 }
  );
}
