import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const role = body?.role as string | undefined;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const filter: Record<string, unknown> = { email };
    if (role) {
      filter.role = role;
    }

    const user = await db.collection('users').findOne(filter);

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Restaurants can only log in after admin approval
    if (user.role === 'RESTAURANT') {
      const profile = await db.collection('restaurantprofiles').findOne({
        $or: [{ email: user.email }, { userId: String(user._id) }],
      });
      const application = await db.collection('restaurantapplications').findOne({
        $or: [{ email: user.email }, { userId: String(user._id) }],
      });

      // Profile = approved. Otherwise use pending application or stored user.approvalStatus
      // (rejected apps are deleted from applications but kept on the user).
      const status = profile
        ? 'APPROVED'
        : application?.status || user.approvalStatus || 'PENDING';

      if (status === 'APPROVED') {
        // Allowed
      } else if (status === 'REJECTED') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Your restaurant application was rejected. Please contact support or re-apply.',
          },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            message:
              'Your restaurant is waiting for admin approval. You cannot sell until approved.',
          },
          { status: 403 }
        );
      }
    }

    // Drivers / riders can only log in after admin approval
    if (user.role === 'RIDER') {
      const profile = await db.collection('driverprofiles').findOne({
        $or: [{ email: user.email }, { userId: String(user._id) }],
      });
      const application = await db.collection('driverapplications').findOne({
        $or: [{ email: user.email }, { userId: String(user._id) }],
      });

      const status = profile
        ? 'APPROVED'
        : application?.status || user.approvalStatus || 'PENDING';

      if (status === 'APPROVED') {
        // Allowed
      } else if (status === 'REJECTED') {
        return NextResponse.json(
          {
            success: false,
            message:
              'Your driver application was rejected. Please contact support or re-apply.',
          },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            message:
              'Your driver application is waiting for admin approval. You cannot deliver until approved.',
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Login failed', error: message },
      { status: 500 }
    );
  }
}
