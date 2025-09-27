// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;
if (!MONGODB_URI) throw new Error("ENV MONGODB_URI belum di-set");

// cache di global, biar tidak reinit di serverless
type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = global as unknown as { mongoose?: Cached };
const cached: Cached = g.mongoose || { conn: null, promise: null };
g.mongoose = cached;

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, { dbName: process.env.MONGODB_DB || undefined })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
