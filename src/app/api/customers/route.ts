import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function mapCustomer(doc: Record<string, unknown>) {
  const createdAt = doc.createdAt || doc.updatedAt;
  const date = createdAt ? new Date(String(createdAt)) : new Date();

  return {
    id: String(doc._id),
    firstName: (doc.firstName as string) || '',
    lastName: (doc.lastName as string) || '',
    name:
      `${doc.firstName || ''} ${doc.lastName || ''}`.trim() ||
      (doc.email as string) ||
      'Customer',
    email: (doc.email as string) || '',
    phone: (doc.phone as string) || '',
    role: 'CUSTOMER' as const,
    createdAt: date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    createdAtIso: date.toISOString(),
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const customers = await db
      .collection('users')
      .find({ role: 'CUSTOMER' })
      .project({ password: 0 })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      customers: customers.map((doc) => mapCustomer(doc)),
      count: customers.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch customers', error: message },
      { status: 500 }
    );
  }
}
