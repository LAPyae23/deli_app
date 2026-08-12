import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProfile from '@/models/CustomerProfile';

const STREAK_REWARD_DAYS = 7;
const STREAK_DISCOUNT_PERCENT = 10;
const STREAK_VOUCHER_CODE = 'STREAK7';

/** UTC calendar day as YYYY-MM-DD */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcMidnightFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function daysBetween(aKey: string, bKey: string): number {
  const a = utcMidnightFromKey(aKey).getTime();
  const b = utcMidnightFromKey(bKey).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * POST /api/customer/streak
 * Body: { customerId: string }
 *
 * Daily check-in when the customer opens the dashboard.
 */
export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const customerId = String(body.customerId || '').trim();

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }

    const today = new Date();
    const todayKey = dayKey(today);

    let profile = await CustomerProfile.findOne({ customerId });
    if (!profile) {
      profile = await CustomerProfile.create({
        customerId,
        streakCount: 0,
        lastLoginDate: null,
        hasStreakReward: false,
        streakDiscountPercent: 0,
        streakVoucherCode: '',
      });
    }

    const last = profile.lastLoginDate ? new Date(profile.lastLoginDate) : null;
    const lastKey = last && !Number.isNaN(last.getTime()) ? dayKey(last) : null;

    let streakCount = Number(profile.streakCount) || 0;
    let alreadyCheckedInToday = false;
    let streakIncreased = false;
    let streakReset = false;
    let rewardGranted = false;
    let milestoneReached = 0;

    if (lastKey === todayKey) {
      // Same calendar day — keep streak as-is
      alreadyCheckedInToday = true;
    } else if (lastKey && daysBetween(lastKey, todayKey) === 1) {
      // Logged in yesterday — continue streak
      streakCount += 1;
      streakIncreased = true;
    } else {
      // Missed a day (or first login) — restart at 1
      streakCount = 1;
      streakReset = Boolean(lastKey);
    }

    if (!alreadyCheckedInToday) {
      profile.lastLoginDate = utcMidnightFromKey(todayKey);

      if (streakCount >= STREAK_REWARD_DAYS) {
        // Milestone: issue 10% voucher and reset streak for a new cycle
        rewardGranted = true;
        milestoneReached = STREAK_REWARD_DAYS;
        profile.hasStreakReward = true;
        profile.streakDiscountPercent = STREAK_DISCOUNT_PERCENT;
        profile.streakVoucherCode = STREAK_VOUCHER_CODE;
        streakCount = 0;
      }

      profile.streakCount = streakCount;
      await profile.save();
    }

    return NextResponse.json({
      success: true,
      streak: {
        streakCount: Number(profile.streakCount) || 0,
        lastLoginDate: profile.lastLoginDate,
        alreadyCheckedInToday,
        streakIncreased,
        streakReset,
        rewardGranted,
        milestoneReached,
        hasStreakReward: Boolean(profile.hasStreakReward),
        streakDiscountPercent: Number(profile.streakDiscountPercent) || 0,
        streakVoucherCode: profile.streakVoucherCode || '',
        milestoneDays: STREAK_REWARD_DAYS,
      },
      message: rewardGranted
        ? `7-day streak complete! ${STREAK_DISCOUNT_PERCENT}% off voucher unlocked (${STREAK_VOUCHER_CODE}).`
        : alreadyCheckedInToday
          ? 'Already checked in today'
          : streakIncreased
            ? `Streak extended to ${Number(profile.streakCount)} day${Number(profile.streakCount) === 1 ? '' : 's'}`
            : `Streak started — day ${Number(profile.streakCount)}`,
    });
  } catch (error) {
    console.error('Customer streak POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update login streak' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/customer/streak?customerId=...
 * Read-only streak status (no check-in).
 */
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'customerId is required' },
        { status: 400 }
      );
    }

    const profile = await CustomerProfile.findOne({ customerId }).select(
      'streakCount lastLoginDate hasStreakReward streakDiscountPercent streakVoucherCode'
    );

    return NextResponse.json({
      success: true,
      streak: {
        streakCount: Number(profile?.streakCount) || 0,
        lastLoginDate: profile?.lastLoginDate || null,
        hasStreakReward: Boolean(profile?.hasStreakReward),
        streakDiscountPercent: Number(profile?.streakDiscountPercent) || 0,
        streakVoucherCode: profile?.streakVoucherCode || '',
        milestoneDays: STREAK_REWARD_DAYS,
      },
    });
  } catch (error) {
    console.error('Customer streak GET error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch streak' },
      { status: 500 }
    );
  }
}
