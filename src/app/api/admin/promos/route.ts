import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import PromoCode from '@/models/PromoCode';
import { campaignLabel, ensureDefaultCampaigns, normalizeCode } from '@/lib/promotions';

type CampaignRow = {
  code: string;
  kind: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
  value: number;
  maxDiscount?: number;
};

/** GET: all campaign codes. POST: create or update one. DELETE ?code=: switch one off. */
export async function GET() {
  await dbConnect();
  await ensureDefaultCampaigns();
  const promos = await PromoCode.find().sort({ createdAt: -1 }).lean<CampaignRow[]>();
  return NextResponse.json({
    success: true,
    promos: promos.map((p) => ({ ...p, label: campaignLabel(p) })),
  });
}

function toDate(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(request: Request) {
  await dbConnect();
  const body = await request.json().catch(() => ({}));
  const code = normalizeCode(body.code);
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) {
    return NextResponse.json(
      { success: false, message: 'Code must be 3 to 20 letters, numbers, dash or underscore' },
      { status: 400 }
    );
  }
  const kind = ['PERCENT', 'FLAT', 'FREE_DELIVERY'].includes(body.kind) ? body.kind : 'PERCENT';
  const value = Math.max(0, Number(body.value) || 0);
  if (kind === 'PERCENT' && (value <= 0 || value > 100)) {
    return NextResponse.json({ success: false, message: 'Percent must be 1 to 100' }, { status: 400 });
  }
  if (kind === 'FLAT' && value <= 0) {
    return NextResponse.json({ success: false, message: 'Amount must be more than 0' }, { status: 400 });
  }
  const promo = await PromoCode.findOneAndUpdate(
    { code },
    {
      $set: {
        code,
        description: String(body.description || '').slice(0, 200),
        kind,
        value,
        maxDiscount: Math.max(0, Number(body.maxDiscount) || 0),
        minSubtotal: Math.max(0, Number(body.minSubtotal) || 0),
        firstOrderOnly: Boolean(body.firstOrderOnly),
        perUserLimit: Math.max(1, Math.round(Number(body.perUserLimit) || 1)),
        totalLimit: Math.max(0, Math.round(Number(body.totalLimit) || 0)),
        startsAt: toDate(body.startsAt),
        expiresAt: toDate(body.expiresAt),
        active: body.active !== false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return NextResponse.json({ success: true, promo });
}

export async function DELETE(request: Request) {
  await dbConnect();
  const code = normalizeCode(new URL(request.url).searchParams.get('code'));
  const res = await PromoCode.updateOne({ code }, { $set: { active: false } });
  if (res.matchedCount === 0) {
    return NextResponse.json({ success: false, message: 'Code not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
