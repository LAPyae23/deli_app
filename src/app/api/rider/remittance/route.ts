import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { applyRemittance, WALLET_BLOCK_THRESHOLD } from '@/lib/riderWallet';

const PAYMENT_METHODS = ['KBZPay', 'WavePay'] as const;

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const riderId = String(body?.riderId || '').trim();
    const amount = Number(body?.amount);
    const method = String(body?.method || '').trim();

    if (!riderId) {
      return NextResponse.json(
        { success: false, message: 'riderId is required' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    if (method && !PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
      return NextResponse.json(
        { success: false, message: 'method must be KBZPay or WavePay' },
        { status: 400 }
      );
    }

    const result = await applyRemittance(riderId, Math.round(amount));
    if (!result) {
      return NextResponse.json(
        { success: false, message: 'Rider not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.isBlocked
        ? 'Remittance recorded. Balance is still at or below the -50,000 Ks limit.'
        : 'Remittance recorded. Account is eligible for new orders.',
      walletBalance: result.walletBalance,
      isBlocked: result.isBlocked,
      credited: result.credited,
      method: method || null,
      threshold: WALLET_BLOCK_THRESHOLD,
    });
  } catch (error) {
    console.error('Rider remittance POST error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to process remittance' },
      { status: 500 }
    );
  }
}
