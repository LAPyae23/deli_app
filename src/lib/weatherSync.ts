import Order from '@/models/Order';
import { getHourlyHistory, yangonHourKey } from '@/lib/weather';

const BATCH = 1000;

/**
 * Give every order that does not yet carry real weather the actual Yangon
 * weather for the hour it was placed (Open-Meteo history). Orders already
 * synced are skipped, so running it again is cheap.
 */
export async function syncOrderWeather() {
  const pending = { weatherSource: { $ne: 'open-meteo' } };
  const total = await Order.countDocuments(pending);
  if (total === 0) return { pending: 0, updated: 0, missing: 0 };

  const [first] = await Order.find(pending)
    .sort({ createdAt: 1 })
    .limit(1)
    .select('createdAt')
    .lean<Array<{ createdAt: Date }>>();
  const startDay = yangonHourKey(new Date(first.createdAt)).slice(0, 10);
  const endDay = yangonHourKey(new Date()).slice(0, 10);
  const history = await getHourlyHistory(startDay, endDay);

  let updated = 0;
  let missing = 0;
  let ops: Parameters<typeof Order.bulkWrite>[0] = [];
  const flush = async () => {
    if (!ops.length) return;
    const r = await Order.bulkWrite(ops, { ordered: false });
    updated += r.modifiedCount;
    ops = [];
  };

  const cursor = Order.find(pending).select('_id createdAt').lean().cursor();
  for await (const doc of cursor as AsyncIterable<{ _id: unknown; createdAt: Date }>) {
    const kind = history.get(yangonHourKey(new Date(doc.createdAt)));
    if (!kind) {
      missing += 1;
      continue;
    }
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { weather: kind, weatherSource: 'open-meteo' } },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return { pending: total, updated, missing, range: { startDay, endDay } };
}
