import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import { clientIp, peekRateLimit, rateLimit, resetRateLimit } from '@/lib/rateLimit';
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

    // Brute-force protection: max 30 attempts per IP and 5 wrong passwords
    // per email in 15 minutes.
    const WINDOW = 15 * 60_000;
    const failKey = `login-fail:${String(email).trim().toLowerCase()}`;
    const ipLimit = await rateLimit(`login-ip:${clientIp(request)}`, 30, WINDOW);
    const fails = await peekRateLimit(failKey, 5);
    if (!ipLimit.allowed || !fails.allowed) {
      const retry = Math.max(ipLimit.allowed ? 0 : ipLimit.retryAfterSec, fails.allowed ? 0 : fails.retryAfterSec);
      return NextResponse.json(
        { success: false, message: `Too many login attempts. Try again in ${Math.ceil(retry / 60)} min.` },
        { status: 429, headers: { 'Retry-After': String(retry) } }
      );
    }

    // Older accounts may have been stored with mixed-case emails.
    const rawEmail = String(email).trim();
    const user = await User.findOne({ email: { $in: [rawEmail, rawEmail.toLowerCase()] } });

    if (!user || user.role !== role) {
      await rateLimit(failKey, 5, WINDOW);
      return NextResponse.json(
        { success: false, message: 'Invalid credentials or wrong role' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await rateLimit(failKey, 5, WINDOW);
      return NextResponse.json(
        { success: false, message: 'Invalid credentials or wrong role' },
        { status: 401 }
      );
    }

    await resetRateLimit(failKey);
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
