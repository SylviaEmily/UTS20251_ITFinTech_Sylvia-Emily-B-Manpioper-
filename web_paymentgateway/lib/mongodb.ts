import mongoose from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // no-var dihapus agar tidak muncul warning “unused eslint-disable”
  var __mongooseCache: MongooseCache | undefined;
}

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Missing MONGODB_URI environment variable');
  return uri;
}

const globalCache: MongooseCache =
  global.__mongooseCache ?? { conn: null, promise: null };

export async function dbConnect(): Promise<typeof mongoose> {
  if (globalCache.conn) return globalCache.conn;

  if (!globalCache.promise) {
    const uri = getMongoUri();
    globalCache.promise = mongoose.connect(uri, { dbName: 'app' });
  }

  globalCache.conn = await globalCache.promise;
  global.__mongooseCache = globalCache;
  return globalCache.conn;
}
