import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { isPasswordValid, PASSWORD_ERROR_MESSAGE } from '@/lib/password';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = String(body?.phone || '').trim();
    const password = String(body?.password || '');
    const role = String(body?.role || 'CUSTOMER').toUpperCase();
    const restaurantName = String(body?.restaurantName || '').trim();
    const cuisine = String(body?.cuisine || '').trim();
    const address = String(body?.address || '').trim();
    const vehicleType = String(body?.vehicleType || '').trim();
    const licenseNumber = String(body?.licenseNumber || '').trim();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Required fields are missing' },
        { status: 400 }
      );
    }

    if (!isPasswordValid(password)) {
      return NextResponse.json(
        { success: false, message: PASSWORD_ERROR_MESSAGE },
        { status: 400 }
      );
    }

    if (role === 'RESTAURANT' && !restaurantName) {
      return NextResponse.json(
        { success: false, message: 'Restaurant name is required' },
        { status: 400 }
      );
    }

    if (role === 'RIDER' && !vehicleType) {
      return NextResponse.json(
        { success: false, message: 'Vehicle type is required' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Email is already registered' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const hashed = await bcrypt.hash(password, 10);
    const needsApproval = role === 'RESTAURANT' || role === 'RIDER';
    const doc = {
      firstName,
      lastName,
      email,
      phone,
      password: hashed,
      role,
      ...(needsApproval ? { approvalStatus: 'PENDING' } : {}),
      createdAt: now,
      updatedAt: now,
      __v: 0,
    };

    const result = await db.collection('users').insertOne(doc);

    if (role === 'ADMIN') {
      await db.collection('adminprofiles').insertOne({
        userId: String(result.insertedId),
        firstName,
        lastName,
        email,
        phone,
        role: 'ADMIN',
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });
    }

    if (role === 'RESTAURANT') {
      const appResult = await db.collection('restaurantapplications').insertOne({
        userId: String(result.insertedId),
        restaurantName,
        ownerName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email,
        phone,
        cuisine: cuisine || 'Not specified',
        address: address || 'Not provided',
        description: '',
        documents: [],
        status: 'PENDING',
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });

      await db.collection('adminnotifications').insertOne({
        type: 'VENDOR_REGISTERED',
        title: 'New restaurant registration',
        message: `${restaurantName} (${firstName} ${lastName}) applied and is waiting for approval.`,
        name: restaurantName,
        email,
        userId: String(result.insertedId),
        applicationId: String(appResult.insertedId),
        read: false,
        createdAt: now,
      });
    }

    if (role === 'RIDER') {
      const appResult = await db.collection('driverapplications').insertOne({
        userId: String(result.insertedId),
        ownerName: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email,
        phone,
        vehicleType,
        licenseNumber: licenseNumber || '',
        address: address || 'Not provided',
        description: '',
        documents: [],
        status: 'PENDING',
        submittedAt: now,
        createdAt: now,
        updatedAt: now,
        __v: 0,
      });

      await db.collection('adminnotifications').insertOne({
        type: 'RIDER_REGISTERED',
        title: 'New rider registration',
        message: `${firstName} ${lastName} applied as a rider (${vehicleType}) and is waiting for approval.`,
        name: `${firstName} ${lastName}`.trim(),
        email,
        userId: String(result.insertedId),
        applicationId: String(appResult.insertedId),
        read: false,
        createdAt: now,
      });
    }

    const message =
      role === 'RESTAURANT'
        ? 'Restaurant application submitted. Waiting for admin approval.'
        : role === 'RIDER'
          ? 'Driver application submitted. Waiting for admin approval.'
          : 'Account created';

    return NextResponse.json({
      success: true,
      message,
      user: {
        id: String(result.insertedId),
        firstName,
        lastName,
        email,
        phone,
        role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: 'Registration failed', error: message },
      { status: 500 }
    );
  }
}
