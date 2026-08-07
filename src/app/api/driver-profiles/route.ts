import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function mapProfile(doc: Record<string, unknown>) {
  const createdAt = doc.approvedAt || doc.createdAt || doc.updatedAt;
  const date = createdAt ? new Date(String(createdAt)) : new Date();

  return {
    id: String(doc._id),
    type: 'RIDER' as const,
    name:
      (doc.ownerName as string) ||
      `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
      'Driver',
    submittedBy:
      (doc.ownerName as string) ||
      `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
      'Driver',
    email: (doc.email as string) || '',
    phone: (doc.phone as string) || '',
    vehicleType: (doc.vehicleType as string) || 'Not specified',
    licenseNumber: (doc.licenseNumber as string) || '',
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
    source: 'profile' as const,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const profiles = await db
      .collection('driverprofiles')
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
      { success: false, message: 'Unable to fetch driver profiles', error: message },
      { status: 500 }
    );
  }
}
