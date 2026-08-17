import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RiderProfile from '@/models/RiderProfile';
import SystemConfig from '@/models/SystemConfig';
import { cacheGetOrSet } from '@/lib/ttlCache';

type HotspotStatus = 'Very High' | 'High' | 'Moderate' | 'Low';

const TOWNSHIP_COORDS: Record<string, { lat: number; lng: number }> = {
  Insein: { lat: 16.895, lng: 96.095 },
  'South Dagon': { lat: 16.825, lng: 96.22 },
  Hlaing: { lat: 16.845, lng: 96.12 },
  Kamaryut: { lat: 16.83, lng: 96.13 },
  Bahan: { lat: 16.81, lng: 96.15 },
  Yankin: { lat: 16.84, lng: 96.16 },
  Mingaladon: { lat: 16.925, lng: 96.135 },
  'North Dagon': { lat: 16.865, lng: 96.195 },
  Mayangone: { lat: 16.87, lng: 96.155 },
  Thingangyun: { lat: 16.835, lng: 96.185 },
};

const DEFAULT_THRESHOLD = 2;

const ACTIVE_HEATMAP_STATUSES = ['PENDING', 'PREPARING', 'READY'] as const;

function statusFromScore(score: number, imbalance: boolean): HotspotStatus {
  if (imbalance) return 'Very High';
  if (score >= 30) return 'Moderate';
  return 'Low';
}

function normalizeTownship(value?: string | null): string {
  const t = String(value || '').trim();
  if (!t) return 'Unknown';
  if (/insein/i.test(t)) return 'Insein';
  if (/south\s*dagon/i.test(t)) return 'South Dagon';
  if (/north\s*dagon/i.test(t)) return 'North Dagon';
  if (/hlaing/i.test(t)) return 'Hlaing';
  if (/kamaryut|kamayut/i.test(t)) return 'Kamaryut';
  if (/bahan/i.test(t)) return 'Bahan';
  if (/yankin/i.test(t)) return 'Yankin';
  if (/mingaladon/i.test(t)) return 'Mingaladon';
  if (/mayangone|mayangon/i.test(t)) return 'Mayangone';
  if (/thingangyun/i.test(t)) return 'Thingangyun';
  return t;
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

    const payload = await cacheGetOrSet('rider-heatmap', 20_000, buildHeatmap);
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Rider heatmap GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to build demand heatmap' },
      { status: 500 }
    );
  }
}

async function buildHeatmap() {

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

    const [townshipCounts, riders] = await Promise.all([
      Order.aggregate(
        [
          { $match: { status: { $in: [...ACTIVE_HEATMAP_STATUSES] } } },
          {
            $group: {
              _id: '$deliveryAddress.township',
              count: { $sum: 1 },
            },
          },
        ],
        { allowDiskUse: true }
      ) as Promise<Array<{ _id?: string | null; count?: number }>>,
      RiderProfile.find({}).select('riderId township status').lean(),
    ]);

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

    for (const row of townshipCounts) {
      const township = normalizeTownship(row._id);
      const count = Number(row.count) || 0;
      if (count <= 0) continue;
      const zone = ensureZone(township);
      zone.orderCount += count;
      zone.activeOrders += count;
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
      return {
        success: true,
        hotspots: [],
        generatedAt: now.toISOString(),
        insight:
          '💡 AI Alert: No hotspot data yet. Complete more deliveries to train demand radar.',
        message: 'No order data available for heatmap',
      };
    }

    const hotspots = aggregates
      .map((agg) => {
        const ridersForRatio =
          agg.onlineRiders > 0 ? agg.onlineRiders : agg.riderCount;
        const activeOrders = Math.max(0, agg.activeOrders);
        const imbalance = activeOrders > ridersForRatio * 2;

        const coords = TOWNSHIP_COORDS[agg.township] || {
          lat: 16.8409,
          lng: 96.1735,
        };

        if (activeOrders === 0) {
          return {
            locationName: agg.township,
            township: agg.township,
            demandScore: 2,
            status: 'Low' as HotspotStatus,
            orderCount: 0,
            activeOrders: 0,
            riderCount: agg.riderCount,
            onlineRiders: agg.onlineRiders,
            availableRiders: ridersForRatio,
            ordersPerRider: 0,
            demandRatio: 0.5,
            imbalance: false,
            surgeActive: false,
            surgeMultiplier: 1.0,
            earningsHint: 'Normal fares',
            lat: coords.lat,
            lng: coords.lng,
          };
        }

        const supply = Math.max(ridersForRatio, 0);
        const demandRatio =
          supply > 0
            ? Number((activeOrders / supply).toFixed(2))
            : Number(activeOrders.toFixed(2));

        const saved = savedByName.get(agg.township);
        const liveMultiplier = imbalance
          ? multiplierFromRatio(Math.max(demandRatio, threshold), threshold)
          : 1.0;
        const surgeMultiplier =
          imbalance && saved?.active && Number(saved.multiplier) > 1
            ? Number(saved.multiplier)
            : liveMultiplier;

        let demandScore = imbalance
          ? Math.min(100, 55 + Math.round(Math.min(activeOrders, 20) * 2))
          : Math.min(28, 8 + activeOrders * 2);

        // Insein is the primary shortage township — boost only when it is actually imbalanced.
        if (agg.township === 'Insein' && imbalance) {
          demandScore = Math.min(100, demandScore + 25);
        }

        const ordersPerRider =
          supply > 0 ? Number((activeOrders / supply).toFixed(1)) : activeOrders;

        return {
          locationName: agg.township,
          township: agg.township,
          demandScore,
          status: statusFromScore(demandScore, imbalance),
          orderCount: agg.orderCount,
          activeOrders,
          riderCount: agg.riderCount,
          onlineRiders: agg.onlineRiders,
          availableRiders: supply,
          ordersPerRider,
          demandRatio,
          imbalance,
          surgeActive: imbalance,
          surgeMultiplier,
          earningsHint: imbalance
            ? `Surge ${surgeMultiplier.toFixed(1)}× — head here for higher pay`
            : 'Normal fares',
          lat: coords.lat,
          lng: coords.lng,
        };
      })
      .sort((a, b) => {
        const inseinBoost = (h: { township: string }) => (h.township === 'Insein' ? 1 : 0);
        if (a.imbalance !== b.imbalance) return a.imbalance ? -1 : 1;
        if (inseinBoost(a) !== inseinBoost(b)) return inseinBoost(b) - inseinBoost(a);
        return b.demandScore - a.demandScore;
      });

    const topImbalance =
      hotspots.find((h) => h.imbalance && h.township === 'Insein') ||
      hotspots.find((h) => h.imbalance) ||
      hotspots.find((h) => h.township === 'Insein') ||
      hotspots[0];
    let insight =
      '💡 Zones look balanced. Keep scanning — surge kicks in when orders exceed riders by 2×.';

    if (topImbalance?.imbalance) {
      insight = `🚨 High demand in ${topImbalance.locationName} — ${topImbalance.activeOrders} live orders vs ${topImbalance.availableRiders} riders (${topImbalance.demandRatio}×). Head there for ${topImbalance.surgeMultiplier.toFixed(1)}× surge earnings!`;
    }

    return {
      success: true,
      hotspots,
      imbalanceThreshold: threshold,
      generatedAt: now.toISOString(),
      insight,
    };
}
