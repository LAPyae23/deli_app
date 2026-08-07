import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RestaurantProfile from '@/models/RestaurantProfile';

const FALLBACK_COORDS = { lat: 16.8409, lng: 96.1735 };

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

    const items = (body.items as Array<Record<string, unknown>>).map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      options: String(item.options ?? ''),
      unitPrice: Number(item.unitPrice) || 0,
      quantity: Number(item.quantity) || 1,
      restaurantName: item.restaurantName ? String(item.restaurantName) : undefined,
      image: item.image ? String(item.image) : undefined,
      imageAlt: item.imageAlt ? String(item.imageAlt) : undefined,
      note: item.note ? String(item.note) : undefined,
    }));

    const orderNumber = `#FP-${Math.floor(1000 + Math.random() * 9000)}`;
    const restaurantName = body.restaurantName || items[0]?.restaurantName || 'Restaurant';
    const restaurantId = body.restaurantId || '';

    // Resolve restaurant pin from profile (by id or name)
    let restaurantCoords = { ...FALLBACK_COORDS };
    try {
      const profileQuery = restaurantId
        ? { restaurantId }
        : { restaurantName };
      const profile = await RestaurantProfile.findOne(profileQuery).lean();
      const lat = Number(profile?.location?.lat);
      const lng = Number(profile?.location?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        restaurantCoords = { lat, lng };
      } else if (!restaurantId && restaurantName) {
        // Fallback: try case-insensitive name match
        const byName = await RestaurantProfile.findOne({
          restaurantName: new RegExp(`^${restaurantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
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

    const newOrder = await Order.create({
      orderNumber,
      restaurantName,
      restaurantId,
      customerName: body.customerName || body.deliveryAddress?.label || 'Customer',
      items,
      totals: body.totals,
      deliveryAddress: body.deliveryAddress,
      paymentMethod: body.paymentMethod || 'card',
      status: 'PENDING',
      restaurantCoords,
    });

    return NextResponse.json({
      success: true,
      orderId: String(newOrder._id),
      orderNumber,
      estimatedDeliveryMinutes: 30,
      message: `Order ${orderNumber} placed successfully`,
    });
  } catch (error) {
    console.error('Database Save Error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to process order' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const restaurantName = searchParams.get('restaurantName');
    const restaurantId = searchParams.get('restaurantId');
    const status = searchParams.get('status');
    const riderId = searchParams.get('riderId');
    const unassigned = searchParams.get('unassigned');

    const filter: Record<string, unknown> = {};
    if (restaurantName) filter.restaurantName = restaurantName;
    if (restaurantId) filter.restaurantId = restaurantId;

    if (status) {
      const statuses = status.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (statuses.length === 1) {
        filter.status = statuses[0];
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses };
      }
    }

    if (riderId) {
      filter.riderId = riderId;
    }

    // Available for riders: e.g. ?status=PREPARING&unassigned=true (or READY)
    if (unassigned === 'true' || unassigned === '1') {
      filter.$or = [
        { riderId: { $exists: false } },
        { riderId: null },
        { riderId: '' },
      ];
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(50);
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
