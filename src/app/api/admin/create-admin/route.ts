import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      adminSessionId,
      firstName,
      lastName,
      email,
      phone,
      password,
    } = body as Record<string, unknown>;

    if (!adminSessionId || typeof adminSessionId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Admin session is required' },
        { status: 401 }
      );
    }

    if (!firstName || !lastName || !email || !phone || !password) {
      return NextResponse.json(
        { success: false, message: 'All fields are required' },
        { status: 400 }
      );
    }

    const passwordStr = String(password);
    if (!PASSWORD_REGEX.test(passwordStr)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Password must be 8+ characters with upper, lower, number, and special character (@$!%*?&#)',
        },
        { status: 400 }
      );
    }

    await dbConnect();

    const requester = await User.findById(String(adminSessionId)).select('role');
    if (!requester || requester.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Only Super Admins can create new admins' },
        { status: 403 }
      );
    }

    const emailNorm = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Email already exists' },
        { status: 400 }
      );
    }

    const lastAdmin = await User.findOne({
      role: 'ADMIN',
      displayId: { $exists: true },
    }).sort({ createdAt: -1 });

    let nextNum = 1;
    if (lastAdmin?.displayId) {
      const match = String(lastAdmin.displayId).match(/\d+$/);
      if (match) nextNum = parseInt(match[0], 10) + 1;
    }
    const displayId = `ADM-${nextNum.toString().padStart(4, '0')}`;

    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    const newAdmin = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      phone: String(phone).trim(),
      password: hashedPassword,
      role: 'ADMIN',
      displayId,
    });

    return NextResponse.json({
      success: true,
      message: 'Admin account created',
      user: {
        id: String(newAdmin._id),
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        email: newAdmin.email,
        role: newAdmin.role,
        displayId: newAdmin.displayId,
      },
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to create admin account' },
      { status: 500 }
    );
  }
}
