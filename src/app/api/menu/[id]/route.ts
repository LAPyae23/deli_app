// app/api/menu/[id]/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import MenuItem from '@/models/MenuItem';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const resolved = await Promise.resolve(params);
    const body = await request.json();

    const update: Record<string, unknown> = {};

    if (typeof body.isAvailable === 'boolean') {
      update.isAvailable = body.isAvailable;
    }
    if (body.stockQuantity !== undefined && body.stockQuantity !== null && body.stockQuantity !== '') {
      const qty = Number(body.stockQuantity);
      if (Number.isFinite(qty)) {
        update.stockQuantity = Math.max(0, qty);
        if (body.isAvailable === undefined) {
          update.isAvailable = qty > 0;
        }
      }
    }
    if (body.name !== undefined) update.name = body.name;
    if (body.category !== undefined) update.category = body.category;
    if (body.description !== undefined) update.description = body.description;
    if (body.price !== undefined && body.price !== '') {
      update.price = Number(body.price);
    }
    if (body.discountPrice !== undefined) {
      update.discountPrice =
        body.discountPrice === '' || body.discountPrice === null
          ? undefined
          : Number(body.discountPrice);
    }
    if (body.prepTime !== undefined) {
      update.prepTime =
        body.prepTime === '' || body.prepTime === null ? undefined : Number(body.prepTime);
    }
    if (typeof body.isPopular === 'boolean') {
      update.isPopular = body.isPopular;
    }
    if (Array.isArray(body.dietaryTags)) {
      update.dietaryTags = body.dietaryTags.map((t: string) => String(t));
    }
    if (Array.isArray(body.addons)) {
      update.addons = body.addons
        .filter((a: { name?: string }) => a?.name?.trim())
        .map((a: { name: string; extraPrice?: number | string }) => ({
          name: String(a.name).trim(),
          extraPrice: Number(a.extraPrice) || 0,
        }));
    }
    if (body.image !== undefined) update.image = body.image || '';
    if (body.imageAlt !== undefined) {
      update.imageAlt = body.imageAlt;
    } else if (body.name !== undefined) {
      update.imageAlt = body.name;
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(
      resolved.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error) {
    console.error('Menu PATCH error:', error);
    return NextResponse.json({ success: false, message: 'Failed to update item' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const resolved = await Promise.resolve(params);
    await MenuItem.findByIdAndDelete(resolved.id);
    return NextResponse.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Failed to delete item' }, { status: 500 });
  }
}
