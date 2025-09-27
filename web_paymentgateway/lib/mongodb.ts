// lib/mongodb.ts
import mongoose, { Mongoose } from 'mongoose';
import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI ?? '';
const MONGODB_DB = process.env.MONGODB_DB ?? '';

if (!MONGODB_URI) {
  throw new Error('Missing MONGODB_URI');
}

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

const cachedMongoose =
  global._mongoose ?? (global._mongoose = { conn: null, promise: null });

const cachedNative =
  global._mongoNative ?? (global._mongoNative = { client: null, promise: null });

/** Koneksi Mongoose untuk Models */
export async function dbConnect(): Promise<Mongoose> {
  if (cachedMongoose.conn) return cachedMongoose.conn;
  if (!cachedMongoose.promise) cachedMongoose.promise = mongoose.connect(MONGODB_URI);
  cachedMongoose.conn = await cachedMongoose.promise;
  return cachedMongoose.conn;
}

/** (Opsional) Native driver kalau mau pakai db.collection() langsung */
export async function connectNative(): Promise<{ client: MongoClient; db: Db }> {
  if (!MONGODB_DB) throw new Error('Missing MONGODB_DB');
  if (cachedNative.client) return { client: cachedNative.client, db: cachedNative.client.db(MONGODB_DB) };
  if (!cachedNative.promise) cachedNative.promise = new MongoClient(MONGODB_URI).connect();
  const client = await cachedNative.promise;
  cachedNative.client = client;
  return { client, db: client.db(MONGODB_DB) };
}

export type { Db };
export default dbConnect;
