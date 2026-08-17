import mongoose from 'mongoose';


const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}


let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  const readyState = mongoose.connection.readyState;
  // 0 = disconnected, 3 = disconnecting — drop the stale cache so the next
  // request opens a fresh pool instead of hanging on a closed monitor.
  if (readyState === 0 || readyState === 3) {
    cached.conn = null;
    cached.promise = null;
  }

  if (cached.conn && readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 8,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30_000,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then(async (conn) => {
      try {
        const Order = (await import('@/models/Order')).default;
        await Order.syncIndexes();
      } catch (error) {
        console.warn('Order index sync skipped:', error);
      }
      return conn;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;