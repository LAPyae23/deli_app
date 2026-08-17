import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

type LeanReview = {
  customerName?: string;
  restaurantRating?: number;
  reviewComment?: string;
  createdAt?: Date;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    await dbConnect();
    const { id } = await Promise.resolve(params);
    const restaurantId = decodeURIComponent(String(id || '').trim());

    if (!restaurantId) {
      return NextResponse.json(
        { success: false, message: 'Restaurant ID required' },
        { status: 400 }
      );
    }

    const rows = (await Order.find({
      restaurantId,
      status: 'DELIVERED',
      reviewComment: { $exists: true, $ne: '' },
    })
      .select('customerName restaurantRating reviewComment createdAt')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean()) as LeanReview[];

    const reviews = rows
      .map((row) => {
        const comment = String(row.reviewComment || '').trim();
        if (!comment) return null;
        const rating = Number(row.restaurantRating);
        return {
          customerName: String(row.customerName || 'Customer').trim() || 'Customer',
          restaurantRating:
            Number.isFinite(rating) && rating >= 1 ? Math.min(5, Math.round(rating)) : 0,
          reviewComment: comment,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const rated = reviews.filter((r) => r.restaurantRating > 0);
    const averageRating =
      rated.length > 0
        ? Math.round(
            (rated.reduce((sum, r) => sum + r.restaurantRating, 0) / rated.length) * 10
          ) / 10
        : null;

    return NextResponse.json({
      success: true,
      reviews,
      count: reviews.length,
      averageRating,
    });
  } catch (error) {
    console.error('Restaurant reviews GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load reviews' },
      { status: 500 }
    );
  }
}
