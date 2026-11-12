import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { logError } from '@/lib/monitoring';

/** POST /api/client-errors — browser errors from the error boundary (20 per hour per IP). */
export async function POST(request: Request) {
  const limit = await rateLimit(`client-error:${clientIp(request)}`, 20, 3600_000);
  if (!limit.allowed) return NextResponse.json({ success: false }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  await logError({
    source: 'client',
    route: body.route,
    message: body.message,
    stack: body.stack,
    userAgent: request.headers.get('user-agent') || '',
  });
  return NextResponse.json({ success: true });
}
