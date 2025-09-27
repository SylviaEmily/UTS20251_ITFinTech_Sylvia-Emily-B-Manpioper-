import mongoose from 'mongoose';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global { var __mongooseCache: Cache | undefined; }

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const cache: Cache = global.__mongooseCache ?? { conn: null, promise: null };

export async function dbConnect(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const uri = requireEnv('MONGODB_URI');  // <-- kalau salah nama, ini langsung error
    cache.promise = mongoose.connect(uri);  // DB name sudah ada di URI
  }
  cache.conn = await cache.promise;
  global.__mongooseCache = cache;
  return cache.conn;
}
