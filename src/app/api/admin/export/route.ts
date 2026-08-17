import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type ExportItem = {
  name?: string;
  category?: string;
  quantity?: number;
};

export async function GET() {
  try {
    await dbConnect();

    const orders = await Order.find({})
      .select(
        'orderNumber restaurantName customerName totals.total totals.totalAmount discount surgePrice weather vehicleType distanceKm durationMins prepTime customerOrderCount items.name items.category items.quantity cancelReason status createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    const header =
      'OrderID,OrderNumber,RestaurantName,CustomerName,TotalAmount,Discount,SurgePrice,Weather,VehicleType,DistanceKm,DurationMins,PrepTimeMins,CustomerOrderCount,Items,CancelReason,Status,CreatedAt';

    const rows = orders.map((order) => {
      const orderId = String(order._id || '');
      const orderNumber = order.orderNumber || '';
      const restaurantName = order.restaurantName || '';
      const customerName = order.customerName || 'N/A';
      const totalAmount =
        Number((order.totals as { total?: number; totalAmount?: number } | undefined)?.total) ||
        Number((order.totals as { totalAmount?: number } | undefined)?.totalAmount) ||
        0;
      const discount = Number(order.discount) || 0;
      const surgePrice = Number(order.surgePrice) || 0;
      const weather = order.weather || 'Sunny';
      const vehicleType = order.vehicleType || 'Motorcycle';
      const distanceKm = Number(order.distanceKm) || 0;
      const durationMins = Number(order.durationMins) || 0;
      const prepTimeMins = Number(order.prepTime) || 15;
      const customerOrderCount = Number(order.customerOrderCount) || 1;
      const cancelReason = order.cancelReason || '';
      const status = order.status || '';
      const createdAt = order.createdAt
        ? new Date(order.createdAt as Date).toISOString()
        : '';

      const orderItems = Array.isArray(order.items)
        ? (order.items as ExportItem[])
        : [];
      const itemsString = orderItems
        .map(
          (i) =>
            `${i.name || 'Item'} (${i.category || 'Fast Food'}) - Qty: ${i.quantity ?? 1}`
        )
        .join(' | ');

      return [
        csvEscape(orderId),
        csvEscape(orderNumber),
        csvEscape(restaurantName),
        csvEscape(customerName),
        csvEscape(totalAmount),
        csvEscape(discount),
        csvEscape(surgePrice),
        csvEscape(weather),
        csvEscape(vehicleType),
        csvEscape(distanceKm),
        csvEscape(durationMins),
        csvEscape(prepTimeMins),
        csvEscape(customerOrderCount),
        csvEscape(itemsString),
        csvEscape(cancelReason),
        csvEscape(status),
        csvEscape(createdAt),
      ].join(',');
    });

    const csvString = [header, ...rows].join('\n');

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="fooddash_complete_dataset.csv"',
      },
    });
  } catch (error) {
    console.error('Admin export GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to export orders' },
      { status: 500 }
    );
  }
}
