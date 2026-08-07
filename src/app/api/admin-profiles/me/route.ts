import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

function mapProfile(doc: Record<string, unknown>, userIdFallback?: string) {
  return {
    id: String(doc.userId || userIdFallback || doc._id || ''),
    profileId: String(doc._id || ''),
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const email = (searchParams.get('email') || '').trim().toLowerCase() || undefined;

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, message: 'userId or email is required' },
        { status: 400 }
      );
    }

    const db = await getDb();

    const profileFilter: Record<string, unknown>[] = [];
    if (userId) profileFilter.push({ userId });
    if (email) profileFilter.push({ email });

    let profile =
      profileFilter.length > 0
        ? await db.collection('adminprofiles').findOne({ $or: profileFilter })
        : null;

    // Fallback to users collection and upsert into adminprofiles if missing
    if (!profile) {
      let user = null;
      if (userId && ObjectId.isValid(userId)) {
        user = await db.collection('users').findOne({ _id: new ObjectId(userId), role: 'ADMIN' });
      }
      if (!user && email) {
        user = await db.collection('users').findOne({ email, role: 'ADMIN' });
      }

      if (!user) {
        return NextResponse.json({ success: false, message: 'Admin profile not found' }, { status: 404 });
      }

      const now = new Date().toISOString();
      const doc = {
        userId: String(user._id),
        firstName: String(user.firstName || ''),
        lastName: String(user.lastName || ''),
        email: String(user.email || '').toLowerCase(),
        phone: String(user.phone || ''),
        role: 'ADMIN',
        avatarUrl: (user.avatarUrl as string | null | undefined) ?? null,
        createdAt: user.createdAt ? String(user.createdAt) : now,
        updatedAt: now,
        __v: 0,
      };

      const insert = await db.collection('adminprofiles').insertOne(doc);
      profile = { _id: insert.insertedId, ...doc };
    }

    return NextResponse.json({
      success: true,
      profile: mapProfile(profile as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch admin profile', error: message },
      { status: 500 }
    );
  }
}
