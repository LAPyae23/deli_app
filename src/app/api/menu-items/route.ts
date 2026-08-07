import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

const RESTAURANT_ALIASES: Record<string, string[]> = {
  'rest-001': ['rest-001', 'burger-bliss-id'],
  'burger-bliss-id': ['rest-001', 'burger-bliss-id'],
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get('restaurantId');
    const db = await getDb();

    const filter: Record<string, unknown> = {};
    if (restaurantId) {
      const aliases = RESTAURANT_ALIASES[restaurantId] || [restaurantId];
      filter.restaurantId = { $in: aliases };
    }

    const items = await db
      .collection('menuitems')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const mapped = items.map((item) => ({
      id: String(item._id),
      restaurantId: item.restaurantId,
      name: item.name,
      category: item.category,
      description: item.description || '',
      price: item.price,
      discountPrice: item.discountPrice ?? 0,
      prepTime: item.prepTime,
      stockQuantity: item.stockQuantity,
      isAvailable: item.isAvailable !== false,
      isPopular: Boolean(item.isPopular),
      popular: Boolean(item.isPopular),
      dietaryTags: item.dietaryTags || [],
      addons: item.addons || [],
      image: item.image || '',
      imageAlt: item.imageAlt || item.name,
      rating: item.rating ?? 4.5,
      ordersToday: item.ordersToday ?? 0,
    }));

    return NextResponse.json({ success: true, items: mapped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch menu items', error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.name || body?.price == null) {
      return NextResponse.json(
        { success: false, message: 'Name and price are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const doc = {
      restaurantId: body.restaurantId || 'burger-bliss-id',
      name: body.name,
      category: body.category || 'food',
      description: body.description || '',
      price: Number(body.price),
      discountPrice: Number(body.discountPrice || 0),
      prepTime: Number(body.prepTime || 15),
      stockQuantity: Number(body.stockQuantity || 20),
      isAvailable: body.isAvailable !== false,
      isPopular: Boolean(body.isPopular),
      dietaryTags: body.dietaryTags || [],
      addons: body.addons || [],
      image: body.image || '',
      imageAlt: body.imageAlt || body.name,
      ordersToday: 0,
      createdAt: now,
      updatedAt: now,
      __v: 0,
    };

    const result = await db.collection('menuitems').insertOne(doc);

    return NextResponse.json({
      success: true,
      item: { id: String(result.insertedId), ...doc },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to create menu item', error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Menu item id is required' },
        { status: 400 }
      );
    }

    const allowed = [
      'name',
      'category',
      'description',
      'price',
      'discountPrice',
      'prepTime',
      'stockQuantity',
      'isAvailable',
      'isPopular',
      'dietaryTags',
      'addons',
      'image',
      'imageAlt',
    ];

    const update: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        update[key] = fields[key];
      }
    }

    const db = await getDb();
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { _id: id };

    const result = await db.collection('menuitems').findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Menu item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: { id: String(result._id), ...result, _id: undefined },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to update menu item', error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Menu item id is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { _id: id };

    const result = await db.collection('menuitems').deleteOne(filter);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Menu item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to delete menu item', error: message },
      { status: 500 }
    );
  }
}
