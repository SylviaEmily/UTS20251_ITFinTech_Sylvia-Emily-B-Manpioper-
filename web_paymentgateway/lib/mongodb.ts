import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI as string;
if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const g = global as unknown as { __mongo?: Cache };
const cached: Cache = g.__mongo ?? { conn: null, promise: null };

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }
  cached.conn = await cached.promise;
  g.__mongo = cached;
  return cached.conn;
}
