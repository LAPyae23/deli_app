import { NextResponse } from 'next/server';

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

    // Simulate backend processing latency
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const orderNumber = `#FP-${Math.floor(1000 + Math.random() * 9000)}`;

    return NextResponse.json({
      success: true,
      orderNumber,
      estimatedDeliveryMinutes: 30,
      message: `Order ${orderNumber} placed successfully`,
      order: {
        id: `ord_${Date.now()}`,
        ...body,
        status: 'PLACED',
        createdAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unable to process order' },
      { status: 500 }
    );
  }
}
