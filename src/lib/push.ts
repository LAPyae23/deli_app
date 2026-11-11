/**
 * Web Push notifications (works on Android Chrome, desktop browsers and
 * iOS 16.4+ home-screen apps). VAPID keys come from env vars when set,
 * otherwise they are generated once and kept in MongoDB.
 */
import mongoose from 'mongoose';
import webpush from 'web-push';
import dbConnect from '@/lib/mongodb';

const PushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
  },
  { timestamps: true }
);
const PushKeysSchema = new mongoose.Schema({ _id: String, publicKey: String, privateKey: String });

export const PushSubscriptionModel =
  (mongoose.models.PushSubscription as mongoose.Model<{
    userId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>) || mongoose.model('PushSubscription', PushSubscriptionSchema);
const PushKeys =
  (mongoose.models.PushKeys as mongoose.Model<{ _id: string; publicKey: string; privateKey: string }>) ||
  mongoose.model('PushKeys', PushKeysSchema);

let keysPromise: Promise<{ publicKey: string; privateKey: string }> | null = null;

export function getVapidKeys() {
  keysPromise ??= (async () => {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    }
    await dbConnect();
    const existing = await PushKeys.findById('vapid').lean();
    if (existing?.publicKey && existing.privateKey) return existing;
    const generated = webpush.generateVAPIDKeys();
    // upsert with $setOnInsert so concurrent first calls agree on one key pair
    await PushKeys.updateOne({ _id: 'vapid' }, { $setOnInsert: generated }, { upsert: true });
    const saved = await PushKeys.findById('vapid').lean();
    return { publicKey: saved!.publicKey, privateKey: saved!.privateKey };
  })().catch((error) => {
    keysPromise = null;
    throw error;
  });
  return keysPromise;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/**
 * Send a notification to every device of these users. Best effort: never
 * throws, gives up after a few seconds, and drops subscriptions the browser
 * says are gone (404/410).
 */
export async function sendPush(userIds: string[], payload: PushPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { sent: 0 };
  try {
    await dbConnect();
    const subs = await PushSubscriptionModel.find({ userId: { $in: ids } }).lean();
    if (!subs.length) return { sent: 0 };
    const { publicKey, privateKey } = await getVapidKeys();
    webpush.setVapidDetails('mailto:support@fooddash.app', publicKey, privateKey);
    const body = JSON.stringify(payload);
    const results = await Promise.race([
      Promise.allSettled(
        subs.map((s) =>
          webpush
            .sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 600 })
            .catch(async (error: { statusCode?: number }) => {
              if (error?.statusCode === 404 || error?.statusCode === 410) {
                await PushSubscriptionModel.deleteOne({ endpoint: s.endpoint });
              }
              throw error;
            })
        )
      ),
      new Promise<PromiseSettledResult<unknown>[]>((resolve) => setTimeout(() => resolve([]), 4000)),
    ]);
    return { sent: results.filter((r) => r.status === 'fulfilled').length };
  } catch (error) {
    console.warn('Push send failed:', error);
    return { sent: 0 };
  }
}

/** Friendly text for an order status change, as the customer sees it. */
export function orderStatusPush(status: string, orderNumber: string): PushPayload | null {
  const s = status.toUpperCase();
  const text: Record<string, string> = {
    PREPARING: 'The restaurant accepted your order and is cooking it.',
    READY: 'Your food is ready and waiting for the rider.',
    OUT_FOR_DELIVERY: 'Your rider is on the way!',
    DELIVERED: 'Delivered — enjoy your meal! Tap to rate.',
    REJECTED: 'Sorry, the restaurant could not take your order.',
    CANCELLED: 'Your order was cancelled.',
  };
  if (!text[s]) return null;
  return { title: `Order ${orderNumber}`, body: text[s], url: '/customer-dashboard', tag: `order-${orderNumber}` };
}
