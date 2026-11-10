import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import MenuItem from '@/models/MenuItem';
import RestaurantProfile from '@/models/RestaurantProfile';
import CustomerProfile from '@/models/CustomerProfile';
import { forbidden, getSession, unauthorized } from '@/lib/auth';
import {
  calculateOrderPricing,
  subtotalFromItems,
} from '@/lib/orderPricing';
import { resolveOrderLines } from '@/lib/orderLines';

const FALLBACK_COORDS = { lat: 16.8409, lng: 96.1735 };

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const restaurantName = searchParams.get('restaurantName');
    const restaurantId = searchParams.get('restaurantId');
    const customerId = searchParams.get('customerId');
    const orderNumber = searchParams.get('orderNumber');
    const status = searchParams.get('status');
    const riderId = searchParams.get('riderId');
    const unassigned = searchParams.get('unassigned');

    const query: Record<string, unknown> = {};
    if (restaurantId) {
      query.restaurantId = restaurantId;
    } else if (restaurantName) {
      query.restaurantName = restaurantName;
    }
    if (customerId) query.customerId = customerId;
    if (riderId) query.riderId = riderId;
    if (orderNumber) query.orderNumber = orderNumber;

    // Scope results to the signed-in user (admins see everything).
    const session = getSession(request);
    if (!session) return unauthorized();
    const isDispatchPool = unassigned === 'true' || unassigned === '1';
    if (session.role === 'CUSTOMER') {
      delete query.restaurantId;
      delete query.restaurantName;
      delete query.riderId;
      query.customerId = session.userId;
    } else if (session.role === 'RESTAURANT') {
      delete query.restaurantId;
      delete query.restaurantName;
      delete query.customerId;
      delete query.riderId;
      // Older orders may only carry the restaurant name.
      const profile = await RestaurantProfile.findOne({ restaurantId: session.userId })
        .select('restaurantName')
        .lean<{ restaurantName?: string }>();
      const ownName = String(profile?.restaurantName || '').trim();
      query.$or = ownName
        ? [{ restaurantId: session.userId }, { restaurantName: ownName }]
        : [{ restaurantId: session.userId }];
    } else if (session.role === 'RIDER') {
      const forRider = searchParams.get('forRiderId')?.trim();
      if (forRider && forRider !== session.userId) {
        return forbidden('You can only access your own data');
      }
      delete query.customerId;
      if (!isDispatchPool) query.riderId = session.userId;
    }

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

    if (isDispatchPool) {
      // Seed / older docs may omit `unassigned` even when no rider is assigned.
      if (query.$or) {
        query.$and = [{ $or: query.$or }];
        delete query.$or;
      }
      const unassignedOr = [
        { unassigned: true },
        {
          unassigned: { $exists: false },
          $or: [{ riderId: { $exists: false } }, { riderId: null }, { riderId: '' }],
        },
      ];
      if (query.$and) {
        (query.$and as unknown[]).push({ $or: unassignedOr });
      } else {
        query.$or = unassignedOr;
      }
    }

    // Offline or blocked riders must not receive dispatch candidates
    const forRiderId = searchParams.get('forRiderId')?.trim() || '';
    if (forRiderId) {
      const RiderProfile = (await import('@/models/RiderProfile')).default;
      const { isRiderBlocked } = await import('@/lib/riderWallet');
      if (await isRiderBlocked(forRiderId)) {
        return NextResponse.json({ success: true, orders: [] });
      }
      const rider = await RiderProfile.findOne({ riderId: forRiderId })
        .select('status')
        .lean();
      if (!rider || String(rider.status) !== 'Online') {
        return NextResponse.json({ success: true, orders: [] });
      }
    }

    const parsedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, parsedLimit) : 50;

    const orders = await Order.find(query)
      .select(
        'orderNumber restaurantName restaurantId customerId customerName status items.name items.quantity items.price items.category items.unitPrice items.id items.options items.note items.restaurantName items.image items.imageAlt totals deliveryAddress paymentMethod createdAt updatedAt riderId riderName prepTime travelMins durationMins restaurantCoords riderCoords discount tipAmount'
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return NextResponse.json({ success: true, orders, limit });
  } catch (error) {
    console.error('Orders GET error:', error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Failed to fetch orders';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const session = getSession(request);
    if (!session) return unauthorized();
    if (session.role !== 'CUSTOMER') {
      return forbidden('Only customer accounts can place orders');
    }

    const body = await request.json();
    // Orders are always placed for the signed-in customer.
    body.customerId = session.userId;

    if (!body?.items?.length || !body?.deliveryAddress?.address) {
      return NextResponse.json(
        { success: false, message: 'Invalid order data' },
        { status: 400 }
      );
    }

    // Price, add-ons, stock and restaurant come from the database, not the client.
    const resolved = await resolveOrderLines(body.items, String(body.restaurantId || ''));
    if (!resolved.ok) {
      return NextResponse.json({ success: false, message: resolved.message }, { status: 400 });
    }
    const items = resolved.items;
    body.restaurantId = resolved.restaurantId;

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

    let restaurantName = String(body.restaurantName || items[0]?.restaurantName || '');
    let restaurantId = resolved.restaurantId;

    let restaurantCoords = { ...FALLBACK_COORDS };
    try {
      const nameRegex = restaurantName
        ? new RegExp(
            `^${String(restaurantName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          )
        : null;
      const profile =
        (restaurantId
          ? await RestaurantProfile.findOne({ restaurantId }).lean()
          : null) ||
        (nameRegex
          ? await RestaurantProfile.findOne({ restaurantName: nameRegex }).lean()
          : await RestaurantProfile.findOne({ restaurantName }).lean());

      if (profile) {
        if (!restaurantId && profile.restaurantId) {
          restaurantId = String(profile.restaurantId);
        }
        if (profile.restaurantName) {
          restaurantName = String(profile.restaurantName);
        }
        const lat = Number(profile.location?.lat);
        const lng = Number(profile.location?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          restaurantCoords = { lat, lng };
        }
      }
    } catch (lookupError) {
      console.warn('Restaurant coords lookup failed, using fallback:', lookupError);
    }

    const weatherOptions = ['Sunny', 'Rainy', 'Cloudy', 'Stormy'] as const;
    const randomWeather =
      weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

    const subtotal = subtotalFromItems(items);
    // Tip is the customer's choice; cap it to keep typos from creating huge charges.
    const tipAmount = Math.min(
      100_000,
      Math.max(0, Math.round(Number(body.tipAmount ?? body.totals?.tipAmount) || 0))
    );
    // Delivery fee is computed on the server (client value ignored).
    const pricing = calculateOrderPricing({ subtotal, tipAmount });

    const customerId = session.userId;

    // Promo: only a code granted to this customer counts, and it is consumed
    // atomically here so the same code cannot be used twice.
    const promoCodeRequested = String(body.promoCodeUsed || body.totals?.promoCodeUsed || '')
      .trim()
      .toUpperCase();
    let discountPercent = 0;
    let promoCodeUsed = '';
    let promoRestore: Record<string, unknown> | null = null;
    if (promoCodeRequested) {
      const profile = await CustomerProfile.findOne({ customerId })
        .select('hasPromo promoCode promoDiscountPercent hasStreakReward streakVoucherCode streakDiscountPercent')
        .lean<{
          hasPromo?: boolean;
          promoCode?: string;
          promoDiscountPercent?: number;
          hasStreakReward?: boolean;
          streakVoucherCode?: string;
          streakDiscountPercent?: number;
        }>();
      const adminCode = String(profile?.promoCode || '').trim().toUpperCase();
      const streakCode = String(profile?.streakVoucherCode || '').trim().toUpperCase();
      if (profile?.hasPromo && adminCode && adminCode === promoCodeRequested) {
        const claimed = await CustomerProfile.findOneAndUpdate(
          { customerId, hasPromo: true, promoCode: profile.promoCode },
          { $set: { hasPromo: false, promoCode: '', promoDiscountPercent: 0 } }
        );
        if (claimed) {
          discountPercent = Number(profile.promoDiscountPercent) || 0;
          promoCodeUsed = promoCodeRequested;
          promoRestore = {
            hasPromo: true,
            promoCode: profile.promoCode,
            promoDiscountPercent: profile.promoDiscountPercent,
          };
        }
      } else if (profile?.hasStreakReward && streakCode && streakCode === promoCodeRequested) {
        const claimed = await CustomerProfile.findOneAndUpdate(
          { customerId, hasStreakReward: true, streakVoucherCode: profile.streakVoucherCode },
          { $set: { hasStreakReward: false, streakVoucherCode: '', streakDiscountPercent: 0 } }
        );
        if (claimed) {
          discountPercent = Number(profile.streakDiscountPercent) || 0;
          promoCodeUsed = promoCodeRequested;
          promoRestore = {
            hasStreakReward: true,
            streakVoucherCode: profile.streakVoucherCode,
            streakDiscountPercent: profile.streakDiscountPercent,
          };
        }
      }
    }
    discountPercent = Math.min(100, Math.max(0, discountPercent));
    const discount = Math.round(pricing.subtotal * (discountPercent / 100));
    const promoApplied = discount > 0;

    // Surge is not charged to customers yet; analytics fields are simulated server-side.
    const surgePrice = 0;
    const weather = randomWeather;
    const cancelReason = '';
    const prepTime = Math.floor(Math.random() * 25 + 12); // 12–36 mins simulated kitchen time
    const travelMins = Math.floor(Math.random() * 25 + 10); // 10–34 mins simulated rider travel
    const durationMins = prepTime + travelMins;

    const [orderSeq, priorCustomerOrders] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ customerId }),
    ]);
    const orderNumber = `#FP-${String(orderSeq + 1).padStart(5, '0')}`;
    const customerOrderCount = priorCustomerOrders + 1;
    const customerTotal = Math.max(0, Math.round(pricing.total - discount));

    const totals = {
      subtotal: pricing.subtotal,
      tax: pricing.tax,
      deliveryFee: pricing.deliveryFee,
      platformFee: pricing.platformFee,
      discount,
      promoApplied,
      promoCodeUsed,
      surgePrice,
      restaurantCommission: pricing.restaurantCommission,
      restaurantCommissionRate: pricing.restaurantCommissionRate,
      total: customerTotal,
      totalAmount: customerTotal,
      riderEarning: pricing.riderEarning,
      owedAmount: Math.max(0, customerTotal - pricing.riderEarning),
      tipAmount: pricing.tipAmount,
      township:
        typeof body.totals?.township === 'string'
          ? body.totals.township
          : body.deliveryAddress?.township || '',
    };

    let newOrder;
    try {
      newOrder = await Order.create({
      orderNumber,
      restaurantName,
      restaurantId,
      customerId,
      customerName: body.customerName || body.deliveryAddress?.label || 'Customer',
      status: 'PENDING',
      items,
      totals,
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
      customerOrderCount,
      unassigned: true,
      baseRiderFee: Math.max(0, pricing.riderEarning - pricing.tipAmount),
      tipAmount: pricing.tipAmount,
    });
    } catch (createError) {
      if (promoRestore) {
        await CustomerProfile.updateOne({ customerId }, { $set: promoRestore }).catch(() => {});
      }
      throw createError;
    }

    // Auto-deduct menu stock for each ordered item
    for (const item of items) {
      const { menuItemId, quantity } = item;

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
