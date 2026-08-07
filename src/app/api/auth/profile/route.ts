import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { isPasswordValid, PASSWORD_ERROR_MESSAGE } from '@/lib/password';

function mapUser(user: Record<string, unknown>) {
  return {
    id: String(user._id),
    firstName: String(user.firstName || ''),
    lastName: String(user.lastName || ''),
    email: String(user.email || ''),
    phone: String(user.phone || ''),
    role: String(user.role || ''),
    avatarUrl: (user.avatarUrl as string | null | undefined) ?? null,
  };
}

async function findUser(db: Awaited<ReturnType<typeof getDb>>, userId?: string, email?: string) {
  if (userId && ObjectId.isValid(userId)) {
    const byId = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (byId) return byId;
  }
  if (email) {
    return db.collection('users').findOne({ email: email.trim().toLowerCase() });
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const email = searchParams.get('email') || undefined;

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, message: 'userId or email is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = await findUser(db, userId, email);

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: mapUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to fetch profile', error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || '').trim();
    const emailLookup = String(body?.emailLookup || body?.currentEmail || '').trim().toLowerCase();
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();
    const password = body?.password != null ? String(body.password) : '';
    const clearAvatar = Boolean(body?.clearAvatar);
    const avatarUrl =
      body?.avatarUrl === null || body?.avatarUrl === undefined
        ? undefined
        : String(body.avatarUrl);

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, message: 'First name and last name are required' },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: 'A valid email address is required' },
        { status: 400 }
      );
    }

    if (password && !isPasswordValid(password)) {
      return NextResponse.json(
        { success: false, message: PASSWORD_ERROR_MESSAGE },
        { status: 400 }
      );
    }

    if (avatarUrl && avatarUrl.startsWith('data:')) {
      const approxBytes = Math.ceil((avatarUrl.length * 3) / 4);
      if (approxBytes > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: 'Profile photo must be 5 MB or smaller' },
          { status: 400 }
        );
      }
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(avatarUrl)) {
        return NextResponse.json(
          { success: false, message: 'Profile photo must be JPG, JPEG, PNG, or WebP' },
          { status: 400 }
        );
      }
    }

    const db = await getDb();
    const user = await findUser(db, userId || undefined, emailLookup || email);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'User not found in database. Sign in with a MongoDB account to update your profile.',
        },
        { status: 404 }
      );
    }

    if (email !== String(user.email || '').toLowerCase()) {
      const taken = await db.collection('users').findOne({
        email,
        _id: { $ne: user._id },
      });
      if (taken) {
        return NextResponse.json(
          { success: false, message: 'Email is already registered' },
          { status: 409 }
        );
      }
    }

    const update: Record<string, unknown> = {
      firstName,
      lastName,
      email,
      phone,
      updatedAt: new Date().toISOString(),
    };

    if (password) {
      update.password = await bcrypt.hash(password, 10);
    }

    if (clearAvatar) {
      update.avatarUrl = null;
    } else if (avatarUrl !== undefined) {
      update.avatarUrl = avatarUrl || null;
    }

    await db.collection('users').updateOne({ _id: user._id }, { $set: update });

    if (String(user.role || '') === 'ADMIN') {
      const profileUpdate: Record<string, unknown> = {
        firstName,
        lastName,
        email,
        phone,
        updatedAt: update.updatedAt,
      };
      if (clearAvatar) {
        profileUpdate.avatarUrl = null;
      } else if (avatarUrl !== undefined) {
        profileUpdate.avatarUrl = avatarUrl || null;
      }

      await db.collection('adminprofiles').updateOne(
        { $or: [{ userId: String(user._id) }, { email: String(user.email || '').toLowerCase() }] },
        {
          $set: profileUpdate,
          $setOnInsert: {
            userId: String(user._id),
            role: 'ADMIN',
            createdAt: update.updatedAt,
            __v: 0,
          },
        },
        { upsert: true }
      );
    }

    const updated = await db.collection('users').findOne({ _id: user._id });
    if (!updated) {
      return NextResponse.json({ success: false, message: 'User not found after update' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: password ? 'Profile and password updated' : 'Profile updated',
      user: mapUser(updated),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Unable to update profile', error: message },
      { status: 500 }
    );
  }
}
