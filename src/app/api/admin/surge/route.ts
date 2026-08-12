import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';
import CustomerProfile from '@/models/CustomerProfile';
import SystemConfig from '@/models/SystemConfig';

const TOWNSHIPS = [
  'South Dagon',
  'Bahan',
  'Kyauktada',
  'Pabedan',
  'Latha',
  'Lanmadaw',
  'Sanchaung',
  'Mayangone',
  'South Okkalapa',
  'North Okkalapa',
] as const;

const DEFAULT_IMBALANCE_THRESHOLD = 2;

/**
 * Map supply/demand ratio → delivery fee multiplier.
 * Threshold (>2×) starts at 1.5× and scales up with pressure.
 */
function multiplierFromRatio(ratio: number, threshold: number): number {
  if (ratio < threshold) return 1.0;
  if (ratio < threshold + 0.5) return 1.5;
  if (ratio < threshold + 1.5) return 1.8;
  if (ratio < threshold + 2.5) return 2.1;
  if (ratio < threshold + 4) return 2.4;
  return 2.8;
}

function demandScoreFromRatio(ratio: number, activeOrders: number): number {
  const ratioScore = Math.min(70, (ratio / 5) * 70);
  const volumeScore = Math.min(30, activeOrders * 2);
  return Math.round(Math.min(100, ratioScore + volumeScore));
}

function matchTownship(value: unknown, township: string) {
  const text = String(value || '');
  if (!text) return false;
  if (text === township) return true;
  const short = township.split('(')[0].trim();
  return text.includes(township) || (short.length > 3 && text.includes(short));
}

function zoneId(township: string) {
  return `zone-${township.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

async function computeLiveZones(threshold: number) {
  const [orders, restaurants, riders, customers] = await Promise.all([
    Order.find({})
      .select('deliveryAddress totals restaurantName status')
      .lean(),
    RestaurantProfile.find({})
      .select('township address description restaurantName')
      .lean(),
    RiderProfile.find({}).select('township status name').lean(),
    CustomerProfile.find({}).select('township savedAddresses').lean(),
  ]);

  return TOWNSHIPS.map((township) => {
    const orderInTownship = (o: (typeof orders)[number]) => {
      const addr = o.deliveryAddress as
        | { township?: string; detail?: string; address?: string }
        | null;
      const totals = o.totals as { township?: string } | null;
      return (
        matchTownship(addr?.township, township) ||
        matchTownship(totals?.township, township) ||
        matchTownship(addr?.detail, township) ||
        matchTownship(addr?.address, township)
      );
    };

    const orderCount = orders.filter(orderInTownship).length;

    const activeOrders = orders.filter((o) => {
      const status = String(o.status || '').toUpperCase();
      const isActive = !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(status);
      return isActive && orderInTownship(o);
    }).length;

    const restaurantCount = restaurants.filter(
      (r) =>
        matchTownship(r.township, township) ||
        matchTownship(r.address, township) ||
        matchTownship(r.description, township)
    ).length;

    const riderDocs = riders.filter((r) => matchTownship(r.township, township));
    const riderCount = riderDocs.length;
    const onlineRiders = riderDocs.filter((r) => r.status === 'Online').length;
    const availableRiders = Math.max(onlineRiders, 0);

    const customerCount = customers.filter((c) => {
      if (matchTownship((c as { township?: string }).township, township)) return true;
      const addrs = Array.isArray(c.savedAddresses) ? c.savedAddresses : [];
      return addrs.some(
        (a: { detail?: string; address?: string }) =>
          matchTownship(a.detail, township) || matchTownship(a.address, township)
      );
    }).length;

    // Supply/demand: active orders vs available (online) riders; fall back to total riders
    const supply = Math.max(availableRiders > 0 ? availableRiders : riderCount, 1);
    const demand = Math.max(activeOrders, 0);
    const demandRatio = Number((demand / supply).toFixed(2));
    const imbalance = demandRatio >= threshold;
    const autoMultiplier = multiplierFromRatio(demandRatio, threshold);
    const demandScore = demandScoreFromRatio(demandRatio, demand);

    return {
      id: zoneId(township),
      name: township,
      multiplier: autoMultiplier,
      active: imbalance,
      autoActivated: imbalance,
      imbalance,
      activeOrders: demand,
      availableRiders: availableRiders > 0 ? availableRiders : riderCount,
      totalOrders: orderCount,
      totalRiders: riderCount,
      onlineRiders,
      customers: customerCount,
      restaurants: restaurantCount,
      demandRatio,
      demandScore,
      threshold,
      suggestedFeeNote: imbalance
        ? `Auto surge ${autoMultiplier.toFixed(1)}× — orders ${demandRatio.toFixed(1)}× riders`
        : 'Balanced supply',
    };
  });
}

export async function GET() {
  try {
    await dbConnect();

    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    }

    const autoSurge = config.autoSurge !== false;
    const threshold = Number(config.surgeImbalanceThreshold) || DEFAULT_IMBALANCE_THRESHOLD;
    const liveZones = await computeLiveZones(threshold);

    let zones = liveZones;

    if (autoSurge) {
      // Persist auto-activated multipliers for other services to read
      config.surgeZones = liveZones.map((z) => ({
        id: z.id,
        name: z.name,
        multiplier: z.multiplier,
        active: z.active,
        autoActivated: z.autoActivated,
        updatedAt: new Date(),
      }));
      await config.save();
    } else {
      // Manual mode: keep live counts but apply saved multipliers/active flags
      const saved = new Map(
        (Array.isArray(config.surgeZones) ? config.surgeZones : []).map((z) => [
          z.id,
          z,
        ])
      );
      zones = liveZones.map((z) => {
        const override = saved.get(z.id);
        if (!override) return { ...z, autoActivated: false };
        return {
          ...z,
          multiplier: Number(override.multiplier) || z.multiplier,
          active: Boolean(override.active),
          autoActivated: false,
          suggestedFeeNote: override.active
            ? `Manual surge ${Number(override.multiplier).toFixed(1)}×`
            : z.suggestedFeeNote,
        };
      });
    }

    const imbalancedCount = zones.filter((z) => z.imbalance || z.active).length;

    return NextResponse.json({
      success: true,
      zones,
      autoSurge,
      surgeImbalanceThreshold: threshold,
      imbalancedCount,
      summary: autoSurge
        ? `Auto-balancer: ${imbalancedCount} zone(s) above ${threshold}× demand`
        : 'Manual surge mode — sliders control multipliers',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Admin surge GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to compute surge zones' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — save manual zone multipliers when autoSurge is off,
 * or update threshold / force rebalance.
 */
export async function PATCH(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    }

    if (body.autoSurge != null) {
      config.autoSurge = Boolean(body.autoSurge);
    }
    if (body.surgeImbalanceThreshold != null) {
      config.surgeImbalanceThreshold = Math.max(
        1,
        Number(body.surgeImbalanceThreshold) || DEFAULT_IMBALANCE_THRESHOLD
      );
    }

    if (Array.isArray(body.zones) && !config.autoSurge) {
      config.surgeZones = body.zones.map(
        (z: {
          id?: string;
          name?: string;
          multiplier?: number;
          active?: boolean;
        }) => ({
          id: String(z.id || ''),
          name: String(z.name || ''),
          multiplier: Math.min(3, Math.max(1, Number(z.multiplier) || 1)),
          active: Boolean(z.active),
          autoActivated: false,
          updatedAt: new Date(),
        })
      );
    }

    // When turning auto on (or forceRebalance), recompute immediately
    if (config.autoSurge || body.forceRebalance) {
      const threshold =
        Number(config.surgeImbalanceThreshold) || DEFAULT_IMBALANCE_THRESHOLD;
      const liveZones = await computeLiveZones(threshold);
      config.surgeZones = liveZones.map((z) => ({
        id: z.id,
        name: z.name,
        multiplier: z.multiplier,
        active: z.active,
        autoActivated: z.autoActivated,
        updatedAt: new Date(),
      }));
    }

    await config.save();

    return NextResponse.json({
      success: true,
      config: {
        autoSurge: config.autoSurge,
        surgeImbalanceThreshold: config.surgeImbalanceThreshold,
        surgeZones: config.surgeZones,
      },
      message: 'Surge configuration updated',
    });
  } catch (error) {
    console.error('Admin surge PATCH error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update surge configuration' },
      { status: 500 }
    );
  }
}
