import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { getSession } from '@/lib/auth';
import { canAccessOrder } from '@/lib/orderAccess';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** How often the server re-reads the order, and how long one connection lives. */
const CHECK_MS = 2_000;
const LIFETIME_MS = 50_000;
const HEARTBEAT_MS = 15_000;
const FINAL = new Set(['DELIVERED', 'CANCELLED', 'REJECTED']);

/**
 * GET /api/orders/[id]/stream — Server-Sent Events for live tracking.
 * Sends the order whenever it changes (status, rider position, ETA). The
 * browser's EventSource reconnects by itself when a connection ends, so
 * each connection is kept short to fit serverless time limits.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(request);
  if (!session) return new Response('Please sign in', { status: 401 });

  await dbConnect();
  const first = await Order.findById(id).lean<Record<string, unknown>>().catch(() => null);
  if (!first) return new Response('Order not found', { status: 404 });
  if (!(await canAccessOrder(session, first))) return new Response('Forbidden', { status: 403 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener('abort', close);

      let lastStamp = '';
      const push = (order: Record<string, unknown>) => {
        const stamp = `${String(order.updatedAt)}|${JSON.stringify(order.riderCoords || {})}|${order.status}`;
        if (stamp === lastStamp) return;
        lastStamp = stamp;
        send(`data: ${JSON.stringify({ order })}\n\n`);
      };

      send('retry: 3000\n\n');
      push(first);

      const started = Date.now();
      let lastBeat = Date.now();
      while (!closed && Date.now() - started < LIFETIME_MS) {
        await new Promise((r) => setTimeout(r, CHECK_MS));
        if (closed) break;
        const order = await Order.findById(id).lean<Record<string, unknown>>().catch(() => null);
        if (!order) break;
        push(order);
        if (FINAL.has(String(order.status || '').toUpperCase())) {
          send('event: done\ndata: {}\n\n');
          break;
        }
        if (Date.now() - lastBeat > HEARTBEAT_MS) {
          send(': keep-alive\n\n');
          lastBeat = Date.now();
        }
      }
      close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
