import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import SystemConfig from '@/models/SystemConfig';

export async function GET() {
  try {
    await dbConnect();

    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Admin config GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch system config' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const update: Record<string, unknown> = {};
    if (body.globalCommission != null) {
      update.globalCommission = Number(body.globalCommission);
    }
    if (body.platformFee != null) {
      update.platformFee = Number(body.platformFee);
    }
    if (body.autoSurge != null) {
      update.autoSurge = Boolean(body.autoSurge);
    }
    if (body.surgeImbalanceThreshold != null) {
      update.surgeImbalanceThreshold = Math.max(1, Number(body.surgeImbalanceThreshold));
    }

    const config = await SystemConfig.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Admin config PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update system config' },
      { status: 500 }
    );
  }
}
