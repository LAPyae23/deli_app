import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

function mapOrderStatusForVendor(status: string): string {
  if (status === 'PLACED') return 'PENDING';
  if (status === 'OUT_FOR_DELIVERY' || status === 'READY') return 'READY';
  if (status === 'PREPARING') return 'PREPARING';
  return status;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const db = await getDb();

    const filter: Record<string, unknown> = {};
    if (status) {
      filter.status = status;
    }

    const orders = await db
      .collection('orders')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const mapped = orders.map((order) => {
      const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
      const items = Array.isArray(order.items) ? order.items : [];
      return {
        id: String(order._id),
        orderNumber: order.orderNumber,
        restaurant: order.restaurantName || 'Restaurant',
        restaurantName: order.restaurantName || 'Restaurant',
        customerName: order.deliveryAddress?.label || 'Customer',
        itemsSummary: items
          .map((item: { name?: string; quantity?: number }) =>
            `${item.name || 'Item'} × ${item.quantity || 1}`
          )
          .join(', '),
        itemsList: items.map(
          (item: { name?: string; quantity?: number }) =>
            `${item.name || 'Item'} × ${item.quantity || 1}`
        ),
        items,
        totals: order.totals,
        total: order.totals?.total ?? 0,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        status: order.status,
        vendorStatus: mapOrderStatusForVendor(order.status),
        date: createdAt.toLocaleDateString('en-US'),
        receivedAt: createdAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
        createdAt: createdAt.toISOString(),
        rating: order.rating ?? null,
        prepTime: order.prepTime,
      };
    });

    return NextResponse.json({ success: true, orders: mapped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch orders', error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.items?.length) {
      return NextResponse.json(
        { success: false, message: 'Cart is empty' },
        { status: 400 }
      );
    }

    if (!body?.deliveryAddress?.address) {
      return NextResponse.json(
        { success: false, message: 'Delivery address is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const orderNumber = `#FP-${Math.floor(1000 + Math.random() * 9000)}`;

    const orderDoc = {
      orderNumber,
      restaurantName: body.restaurantName || body.items?.[0]?.restaurantName || 'Restaurant',
      status: 'PLACED',
      items: body.items,
      totals: body.totals,
      deliveryAddress: body.deliveryAddress,
      paymentMethod: body.paymentMethod || 'cash',
      estimatedDeliveryMinutes: 30,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    };

    const result = await db.collection('orders').insertOne(orderDoc);

    return NextResponse.json({
      success: true,
      orderNumber,
      estimatedDeliveryMinutes: 30,
      message: `Order ${orderNumber} placed successfully`,
      order: {
        id: String(result.insertedId),
        ...orderDoc,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to process order', error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, prepTime } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: 'Order id and status are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const update: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (typeof prepTime === 'number') {
      update.prepTime = prepTime;
    }

    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { _id: id };

    const result = await db.collection('orders').findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: String(result._id),
        ...result,
        _id: undefined,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to update order', error: message },
      { status: 500 }
    );
  }
}
