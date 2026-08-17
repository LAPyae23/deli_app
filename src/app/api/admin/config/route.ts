import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import SystemConfig from '@/models/SystemConfig';

function clampRate(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function clampRadiusKm(value: unknown, fallback = 7) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(1, Math.round(n)));
}

function serializeConfig(config: unknown) {
  if (!config || typeof config !== 'object') {
    return {
      restaurantCommission: 30,
      riderCommission: 10,
      maxDeliveryRadiusKm: 7,
    };
  }

  const doc = config as { toObject?: () => Record<string, unknown> };
  const raw =
    typeof doc.toObject === 'function' ? doc.toObject() : { ...(config as Record<string, unknown>) };
  const { platformFee: _removed, ...rest } = raw;

  return {
    ...rest,
    restaurantCommission: clampRate(rest.restaurantCommission, 30),
    riderCommission: clampRate(rest.riderCommission, 10),
    maxDeliveryRadiusKm: clampRadiusKm(rest.maxDeliveryRadiusKm, 7),
  };
}

export async function GET() {
  try {
    await dbConnect();

    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    } else {
      const patch: Record<string, unknown> = {};
      if (config.restaurantCommission == null) patch.restaurantCommission = 30;
      if (config.riderCommission == null) patch.riderCommission = 10;
      if (config.maxDeliveryRadiusKm == null) patch.maxDeliveryRadiusKm = 7;
      const updated = await SystemConfig.findByIdAndUpdate(
        config._id,
        { $set: patch, $unset: { platformFee: 1 } },
        { new: true }
      );
      if (updated) config = updated;
    }

    return NextResponse.json({
      success: true,
      config: serializeConfig(config),
    });
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
      update.globalCommission = clampRate(body.globalCommission, 18);
    }
    if (body.restaurantCommission != null) {
      update.restaurantCommission = clampRate(body.restaurantCommission, 30);
    }
    if (body.riderCommission != null) {
      update.riderCommission = clampRate(body.riderCommission, 10);
    }
    if (body.maxDeliveryRadiusKm != null) {
      update.maxDeliveryRadiusKm = clampRadiusKm(body.maxDeliveryRadiusKm, 7);
    }
    if (body.autoSurge != null) {
      update.autoSurge = Boolean(body.autoSurge);
    }
    if (body.surgeImbalanceThreshold != null) {
      update.surgeImbalanceThreshold = Math.max(
        1,
        Number(body.surgeImbalanceThreshold)
      );
    }

    const config = await SystemConfig.findOneAndUpdate(
      {},
      { $set: update, $unset: { platformFee: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return NextResponse.json({
      success: true,
      config: serializeConfig(config),
    });
  } catch (error) {
    console.error('Admin config PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update system config' },
      { status: 500 }
    );
  }
}
