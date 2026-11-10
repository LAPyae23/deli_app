import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, type Role } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    let body: { email?: string; password?: string; role?: string } = {};
    try {
      const raw = await request.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid login payload' },
        { status: 400 }
      );
    }

    const { email, password, role } = body;

    if (!email || !password || !role) {
      return NextResponse.json(
        { success: false, message: 'Email, password, and role are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Older accounts may have been stored with mixed-case emails.
    const rawEmail = String(email).trim();
    const user = await User.findOne({ email: { $in: [rawEmail, rawEmail.toLowerCase()] } });

    if (!user || user.role !== role) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials or wrong role' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials or wrong role' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      userId: user._id,
      user: {
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        role: user.role,
      },
    });
    const token = await createSessionToken({
      userId: String(user._id),
      role: user.role as Role,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
