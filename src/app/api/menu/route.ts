// app/api/menu/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import MenuItem from '@/models/MenuItem';

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const query = restaurantId ? { restaurantId } : {};
    const items = await MenuItem.find(query)
      .select(
        'restaurantId name category description price discountPrice prepTime stockQuantity isAvailable isPopular dietaryTags addons image imageAlt rating'
      )
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Menu GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    if (!body.restaurantId) {
      return NextResponse.json(
        { success: false, message: 'restaurantId is required' },
        { status: 400 }
      );
    }

    const addons = Array.isArray(body.addons)
      ? body.addons
          .filter((a: { name?: string; extraPrice?: number | string }) => a?.name?.trim())
          .map((a: { name: string; extraPrice?: number | string }) => ({
            name: String(a.name).trim(),
            extraPrice: Number(a.extraPrice) || 0,
          }))
      : [];

    const dietaryTags = Array.isArray(body.dietaryTags)
      ? body.dietaryTags.map((t: string) => String(t))
      : [];

    const discountRaw = body.discountPrice;
    const discountPrice =
      discountRaw === '' || discountRaw === null || discountRaw === undefined
        ? undefined
        : Number(discountRaw);

    const prepRaw = body.prepTime;
    const prepTime =
      prepRaw === '' || prepRaw === null || prepRaw === undefined
        ? undefined
        : Number(prepRaw);

    const newItem = await MenuItem.create({
      restaurantId: String(body.restaurantId),
      name: body.name,
      category: body.category,
      description: body.description,
      price: Number(body.price),
      discountPrice: Number.isFinite(discountPrice) ? discountPrice : undefined,
      prepTime: Number.isFinite(prepTime) ? prepTime : undefined,
      stockQuantity: Number(body.stockQuantity) || 0,
      dietaryTags,
      isPopular: Boolean(body.isPopular),
      addons,
      image: body.image || '',
      imageAlt: body.name || 'Menu Item',
      isAvailable: (Number(body.stockQuantity) || 0) > 0,
    });

    return NextResponse.json(
      { success: true, item: newItem, message: 'Menu item added successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Menu Creation Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to add menu item' },
      { status: 500 }
    );
  }
}
