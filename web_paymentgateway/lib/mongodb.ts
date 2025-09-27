// lib/mongodb.ts
import mongoose from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// deklarasi global cache dengan tipe jelas
declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

// helper: pastikan uri ada dan kembalikan sebagai string murni
function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable');
  }
  return uri;
}

const globalCache: MongooseCache =
  global.__mongooseCache ?? { conn: null, promise: null };

export async function dbConnect(): Promise<typeof mongoose> {
  if (globalCache.conn) return globalCache.conn;

  if (!globalCache.promise) {
    const uri = getMongoUri(); // <-- sekarang pasti string, tidak union
    globalCache.promise = mongoose.connect(uri, { dbName: 'app' });
  }

  globalCache.conn = await globalCache.promise;
  global.__mongooseCache = globalCache; // simpan untuk reuse
  return globalCache.conn;
}
