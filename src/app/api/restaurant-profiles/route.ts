import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function mapProfile(doc: Record<string, unknown>) {
  const createdAt = doc.approvedAt || doc.createdAt || doc.updatedAt;
  const date = createdAt ? new Date(String(createdAt)) : new Date();

  return {
    id: String(doc._id),
    type: 'VENDOR' as const,
    name: (doc.restaurantName as string) || 'Unnamed Restaurant',
    submittedBy:
      (doc.ownerName as string) ||
      `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
      'Owner',
    email: (doc.email as string) || '',
    phone: (doc.phone as string) || '',
    cuisine: (doc.cuisine as string) || 'Not specified',
    address: (doc.address as string) || 'Not provided',
    description: (doc.description as string) || '',
    submittedAt: date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    documents: Array.isArray(doc.documents) ? doc.documents.length : 0,
    status: 'APPROVED' as const,
    commissionRate: doc.commissionRate ?? 18,
    source: 'profile' as const,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const profiles = await db
      .collection('restaurantprofiles')
      .find({})
      .sort({ approvedAt: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      profiles: profiles.map((doc) => mapProfile(doc)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch restaurant profiles', error: message },
      { status: 500 }
    );
  }
}
