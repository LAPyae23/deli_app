import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Missing MONGODB_URI in .env');
}

interface MongoCache {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoCache: MongoCache | undefined;
}

const cache: MongoCache = global._mongoCache ?? { client: null, promise: null };
global._mongoCache = cache;

export async function getMongoClient(): Promise<MongoClient> {
  if (cache.client) {
    return cache.client;
  }

  if (!cache.promise) {
    cache.promise = MongoClient.connect(uri as string);
  }

  cache.client = await cache.promise;
  return cache.client;
}

export async function getDb(dbName = 'FoodDashDB'): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}
