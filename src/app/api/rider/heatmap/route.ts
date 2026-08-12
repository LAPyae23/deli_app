import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RestaurantProfile from '@/models/RestaurantProfile';
import RiderProfile from '@/models/RiderProfile';
import SystemConfig from '@/models/SystemConfig';

type HotspotStatus = 'Very High' | 'High' | 'Moderate' | 'Low';

const TOWNSHIP_COORDS: Record<string, { lat: number; lng: number }> = {
  'South Dagon': { lat: 16.8512, lng: 96.2128 },
  Bahan: { lat: 16.8156, lng: 96.1536 },
  Kyauktada: { lat: 16.7738, lng: 96.1621 },
  Pabedan: { lat: 16.7785, lng: 96.1558 },
  Latha: { lat: 16.7758, lng: 96.1502 },
  Lanmadaw: { lat: 16.773, lng: 96.142 },
  Sanchaung: { lat: 16.8068, lng: 96.1334 },
  Mayangone: { lat: 16.868, lng: 96.152 },
  'South Okkalapa': { lat: 16.847, lng: 96.182 },
  'North Okkalapa': { lat: 16.88, lng: 96.158 },
};

const DEFAULT_THRESHOLD = 2;

function statusFromScore(score: number, imbalance: boolean): HotspotStatus {
  if (imbalance || score >= 80) return 'Very High';
  if (score >= 55) return 'High';
  if (score >= 30) return 'Moderate';
  return 'Low';
}

function normalizeTownship(value?: string | null): string {
  const t = String(value || '').trim();
  if (!t) return 'Unknown';
  if (/south\s*dagon/i.test(t)) return 'South Dagon';
  if (/bahan/i.test(t)) return 'Bahan';
  if (/kyauktada/i.test(t)) return 'Kyauktada';
  if (/pabedan/i.test(t)) return 'Pabedan';
  if (/latha/i.test(t)) return 'Latha';
  if (/lanmadaw/i.test(t)) return 'Lanmadaw';
  if (/sanchaung/i.test(t)) return 'Sanchaung';
  if (/mayangone|mayangon/i.test(t)) return 'Mayangone';
  if (/south\s*okkalapa/i.test(t)) return 'South Okkalapa';
  if (/north\s*okkalapa/i.test(t)) return 'North Okkalapa';
  return t;
}

function matchTownship(value: unknown, township: string) {
  const text = String(value || '');
  if (!text) return false;
  if (text === township) return true;
  const short = township.split('(')[0].trim();
  return text.includes(township) || (short.length > 3 && text.includes(short));
}

function multiplierFromRatio(ratio: number, threshold: number): number {
  if (ratio < threshold) return 1.0;
  if (ratio < threshold + 0.5) return 1.5;
  if (ratio < threshold + 1.5) return 1.8;
  if (ratio < threshold + 2.5) return 2.1;
  if (ratio < threshold + 4) return 2.4;
  return 2.8;
}

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const config = await SystemConfig.findOne().lean();
    const threshold =
      Number((config as { surgeImbalanceThreshold?: number } | null)?.surgeImbalanceThreshold) ||
      DEFAULT_THRESHOLD;

    const savedZones = Array.isArray(
      (config as { surgeZones?: Array<{ name?: string; multiplier?: number; active?: boolean }> } | null)
        ?.surgeZones
    )
      ? (
          config as {
            surgeZones: Array<{ name?: string; multiplier?: number; active?: boolean }>;
          }
        ).surgeZones
      : [];

    const savedByName = new Map(
      savedZones.map((z) => [String(z.name || ''), z] as const)
    );

    const [orders, restaurants, riders] = await Promise.all([
      Order.find({})
        .select(
          'restaurantId restaurantName restaurantCoords deliveryAddress totals status createdAt'
        )
        .lean(),
      RestaurantProfile.find({})
        .select('restaurantId restaurantName township')
        .lean(),
      RiderProfile.find({}).select('riderId township status').lean(),
    ]);

    const restaurantTownship = new Map<string, string>();
    for (const r of restaurants) {
      const id = String(r.restaurantId || '');
      const township = normalizeTownship(r.township);
      if (id) restaurantTownship.set(id, township);
      if (r.restaurantName) {
        restaurantTownship.set(String(r.restaurantName).toLowerCase(), township);
      }
    }

    type ZoneAgg = {
      township: string;
      orderCount: number;
      activeOrders: number;
      riderCount: number;
      onlineRiders: number;
    };

    const zones = new Map<string, ZoneAgg>();

    const ensureZone = (township: string) => {
      if (!zones.has(township)) {
        zones.set(township, {
          township,
          orderCount: 0,
          activeOrders: 0,
          riderCount: 0,
          onlineRiders: 0,
        });
      }
      return zones.get(township)!;
    };

    for (const name of Object.keys(TOWNSHIP_COORDS)) {
      ensureZone(name);
    }

    for (const order of orders) {
      const rid = String(order.restaurantId || '');
      const byId = restaurantTownship.get(rid);
      const byName = restaurantTownship.get(
        String(order.restaurantName || '').toLowerCase()
      );
      const addr = order.deliveryAddress as
        | { township?: string; address?: string; detail?: string }
        | string
        | null;
      const totals = order.totals as { township?: string } | null;
      const fromAddr =
        typeof addr === 'string'
          ? normalizeTownship(addr)
          : normalizeTownship(addr?.township || addr?.detail || addr?.address);
      const fromTotals = normalizeTownship(totals?.township);

      const township =
        byId ||
        byName ||
        (fromTotals !== 'Unknown' ? fromTotals : null) ||
        (fromAddr !== 'Unknown' ? fromAddr : null) ||
        'Unknown';

      const zone = ensureZone(township);
      zone.orderCount += 1;
      const status = String(order.status || '').toUpperCase();
      if (!['DELIVERED', 'CANCELLED', 'REJECTED'].includes(status)) {
        zone.activeOrders += 1;
      }
    }

    for (const rider of riders) {
      const township = normalizeTownship(rider.township);
      const zone = ensureZone(township);
      zone.riderCount += 1;
      if (String(rider.status) === 'Online') {
        zone.onlineRiders += 1;
      }
    }

    const aggregates = Array.from(zones.values()).filter(
      (z) => z.township !== 'Unknown' || z.orderCount > 0
    );

    if (aggregates.length === 0) {
      return NextResponse.json({
        success: true,
        hotspots: [],
        generatedAt: now.toISOString(),
        insight:
          '💡 AI Alert: No hotspot data yet. Complete more deliveries to train demand radar.',
        message: 'No order data available for heatmap',
      });
    }

    const hotspots = aggregates
      .map((agg) => {
        const supply = Math.max(
          agg.onlineRiders > 0 ? agg.onlineRiders : agg.riderCount,
          1
        );
        const demand = Math.max(agg.activeOrders, Math.round(agg.orderCount * 0.12));
        const demandRatio = Number((demand / supply).toFixed(2));
        const imbalance = demandRatio >= threshold;

        const saved = savedByName.get(agg.township);
        const liveMultiplier = multiplierFromRatio(demandRatio, threshold);
        const surgeMultiplier =
          saved?.active && Number(saved.multiplier) > 1
            ? Number(saved.multiplier)
            : liveMultiplier;

        // Score: prioritize active imbalance for rider routing
        const ratioScore = Math.min(65, (demandRatio / 5) * 65);
        const volumeScore = Math.min(25, demand * 3);
        const surgeBoost = imbalance ? 15 : surgeMultiplier > 1 ? 8 : 0;
        const demandScore = Math.round(
          Math.min(100, ratioScore + volumeScore + surgeBoost)
        );

        const coords = TOWNSHIP_COORDS[agg.township] || {
          lat: 16.8409,
          lng: 96.1735,
        };

        const ordersPerRider = Number((demand / supply).toFixed(1));

        return {
          locationName: agg.township,
          township: agg.township,
          demandScore,
          status: statusFromScore(demandScore, imbalance),
          orderCount: agg.orderCount,
          activeOrders: demand,
          riderCount: agg.riderCount,
          onlineRiders: agg.onlineRiders,
          availableRiders: supply,
          ordersPerRider,
          demandRatio,
          imbalance,
          surgeActive: imbalance || surgeMultiplier > 1,
          surgeMultiplier,
          earningsHint: imbalance
            ? `Surge ${surgeMultiplier.toFixed(1)}× — head here for higher pay`
            : 'Normal fares',
          lat: coords.lat,
          lng: coords.lng,
        };
      })
      .filter(
        (h) =>
          h.orderCount > 0 ||
          h.activeOrders > 0 ||
          Object.prototype.hasOwnProperty.call(TOWNSHIP_COORDS, h.township)
      )
      .sort((a, b) => {
        if (a.imbalance !== b.imbalance) return a.imbalance ? -1 : 1;
        return b.demandScore - a.demandScore;
      });

    const topImbalance = hotspots.find((h) => h.imbalance) || hotspots[0];
    let insight =
      '💡 Zones look balanced. Keep scanning — surge kicks in when orders exceed riders by 2×.';

    if (topImbalance?.imbalance) {
      insight = `🚨 High demand in ${topImbalance.locationName} — ${topImbalance.demandRatio}× more orders than riders. Head there for ${topImbalance.surgeMultiplier.toFixed(1)}× surge earnings!`;
    } else if (topImbalance && topImbalance.demandScore >= 70) {
      insight = `💡 AI Alert: Rising demand in ${topImbalance.locationName}. Move closer to catch the next surge.`;
    }

    return NextResponse.json({
      success: true,
      hotspots,
      imbalanceThreshold: threshold,
      generatedAt: now.toISOString(),
      insight,
    });
  } catch (error) {
    console.error('Rider heatmap GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build demand heatmap' },
      { status: 500 }
    );
  }
}
