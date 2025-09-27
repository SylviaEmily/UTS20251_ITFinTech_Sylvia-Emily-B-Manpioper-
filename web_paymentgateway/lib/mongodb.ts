// lib/mongodb.ts
import mongoose, { Mongoose } from 'mongoose';
import { MongoClient, Db } from 'mongodb';

/** ENV */
const MONGODB_URI = process.env.MONGODB_URI ?? '';
const MONGODB_DB = process.env.MONGODB_DB ?? '';

/** Deklarasi cache global agar tidak pakai `any` */
declare global {
  // eslint-disable-next-line no-var
  var _mongoose:
    | { conn: Mongoose | null; promise: Promise<Mongoose> | null }
    | undefined;

  // eslint-disable-next-line no-var
  var _mongoNative:
    | { client: MongoClient | null; promise: Promise<MongoClient> | null }
    | undefined;
}

/** Init cache (sekali saja per proses) */
const cachedMongoose =
  global._mongoose ?? (global._mongoose = { conn: null, promise: null });

const cachedNative =
  global._mongoNative ?? (global._mongoNative = { client: null, promise: null });

/** Koneksi via Mongoose (untuk Models) */
export async function dbConnect(): Promise<Mongoose> {
  if (cachedMongoose.conn) return cachedMongoose.conn;

  if (!MONGODB_URI) {
    // lempar di dalam fungsi agar bisa ditangkap try/catch handler API
    throw new Error('Missing MONGODB_URI');
  }

  if (!cachedMongoose.promise) {
    cachedMongoose.promise = mongoose.connect(MONGODB_URI);
  }
  cachedMongoose.conn = await cachedMongoose.promise;
  return cachedMongoose.conn;
}

/** Koneksi via Native Driver (untuk akses collection langsung) */
export async function connectNative(): Promise<{ client: MongoClient; db: Db }> {
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');
  if (!MONGODB_DB) throw new Error('Missing MONGODB_DB');

  if (cachedNative.client) {
    return { client: cachedNative.client, db: cachedNative.client.db(MONGODB_DB) };
  }

  if (!cachedNative.promise) {
    cachedNative.promise = new MongoClient(MONGODB_URI).connect();
  }

  const client = await cachedNative.promise;
  cachedNative.client = client;
  return { client, db: client.db(MONGODB_DB) };
}

export type { Db };
export default dbConnect;
