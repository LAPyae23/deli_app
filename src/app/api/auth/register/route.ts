import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, password, role } = body;

    if (!firstName || !lastName || !email || !phone || !password || !role) {
      return NextResponse.json(
        { success: false, message: 'All fields are required' },
        { status: 400 }
      );
    }

    if (role === 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Admin accounts must be created from the admin terminal' },
        { status: 403 }
      );
    }

    const allowedRoles = new Set(['CUSTOMER', 'RESTAURANT', 'RIDER']);
    if (!allowedRoles.has(role)) {
      return NextResponse.json(
        { success: false, message: 'Invalid role' },
        { status: 400 }
      );
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { success: false, message: 'Password does not meet complexity requirements' },
        { status: 400 }
      );
    }

    await dbConnect();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let displayId = undefined;
    if (role === 'CUSTOMER') {
      const lastCustomer = await User.findOne({
        role: 'CUSTOMER',
        displayId: { $exists: true },
      }).sort({ createdAt: -1 });
      let nextNum = 1;
      if (lastCustomer && lastCustomer.displayId) {
        const match = lastCustomer.displayId.match(/\d+$/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      displayId = `CUST-${nextNum.toString().padStart(4, '0')}`;
    }

    const newUser = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      role,
      displayId,
    });

    return NextResponse.json({
      success: true,
      userId: newUser._id,
      user: {
        firstName,
        lastName,
        email,
        role,
        name: `${firstName} ${lastName}`.trim(),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Unable to register account' },
      { status: 500 }
    );
  }
}
