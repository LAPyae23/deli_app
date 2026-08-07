import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

function mapAdminProfile(doc: Record<string, unknown>) {
  return {
    id: String(doc._id),
    userId: String(doc.userId || ''),
    firstName: String(doc.firstName || ''),
    lastName: String(doc.lastName || ''),
    email: String(doc.email || ''),
    phone: String(doc.phone || ''),
    role: String(doc.role || 'ADMIN'),
    avatarUrl: (doc.avatarUrl as string | null | undefined) ?? null,
    createdAt: doc.createdAt ? String(doc.createdAt) : null,
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const profiles = await db
      .collection('adminprofiles')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      profiles: profiles.map((doc) => mapAdminProfile(doc)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch admin profiles', error: message },
      { status: 500 }
    );
  }
}

/** One-time helper: copy existing ADMIN users into adminprofiles if missing. */
export async function POST() {
  try {
    const db = await getDb();
    const admins = await db.collection('users').find({ role: 'ADMIN' }).toArray();
    let created = 0;
    let skipped = 0;

    for (const admin of admins) {
      const email = String(admin.email || '').toLowerCase();
      const userId = String(admin._id);
      const existing = await db.collection('adminprofiles').findOne({
        $or: [{ userId }, { email }],
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      await db.collection('adminprofiles').insertOne({
        userId,
        firstName: String(admin.firstName || ''),
        lastName: String(admin.lastName || ''),
        email,
        phone: String(admin.phone || ''),
        role: 'ADMIN',
        avatarUrl: (admin.avatarUrl as string | null | undefined) ?? null,
        createdAt: admin.createdAt ? String(admin.createdAt) : now,
        updatedAt: now,
        __v: 0,
      });
      created += 1;
    }

    return NextResponse.json({
      success: true,
      message: `Admin profiles synced. Created ${created}, skipped ${skipped}.`,
      created,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to sync admin profiles', error: message },
      { status: 500 }
    );
  }
}
