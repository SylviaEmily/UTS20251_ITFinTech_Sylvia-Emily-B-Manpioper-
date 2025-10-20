// lib/mongodb.ts
import mongoose from 'mongoose';

type Cache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // cache koneksi mongoose agar reuse di serverless (Vercel)
  // dan flag untuk mencegah event listener terdaftar berulang
  // (property di global harus optional agar tidak bentrok type checking)
  // eslint-disable-next-line no-var
  var __mongooseCache: Cache | undefined;
  // eslint-disable-next-line no-var
  var __mongooseListenersBound: boolean | undefined;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// pakai cache global bila ada, kalau belum ada inisialisasi baru
const cache: Cache = global.__mongooseCache ?? { conn: null, promise: null };

export async function dbConnect(): Promise<typeof mongoose> {
  // Jika sudah ada koneksi aktif, pakai ulang
  if (cache.conn) return cache.conn;

  // Jika belum ada promise koneksi, inisialisasi
  if (!cache.promise) {
    const uri = requireEnv('MONGODB_URI');

    // Opsi yang ramah Vercel + Atlas (serverless-friendly)
    const options: mongoose.ConnectOptions = {
      bufferCommands: false,          // penting untuk serverless
      maxPoolSize: 10,                // batas atas pool
      minPoolSize: 1,                 // minimal pool
      socketTimeoutMS: 45_000,        // tutup socket idle 45s
      serverSelectionTimeoutMS: 30_000,
      family: 4,                      // prefer IPv4
      retryWrites: true,
      w: 'majority',
    };

    console.log('🔗 Connecting to MongoDB...');
    cache.promise = mongoose
      .connect(uri, options)
      .then((m) => {
        console.log('✅ MongoDB connected successfully');
        return m;
      })
      .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        // reset agar percobaan berikutnya bisa re-init
        cache.promise = null;
        throw err;
      });
  }

  try {
    cache.conn = await cache.promise;
    global.__mongooseCache = cache;

    // Bind event listener sekali saja (hindari duplikasi di dev/hot-reload)
    if (!global.__mongooseListenersBound) {
      mongoose.connection.on('connected', () => {
        console.log('✅ Mongoose connected to MongoDB');
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ Mongoose connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('🔌 Mongoose disconnected from MongoDB');
      });

      // Catatan: Vercel Serverless tidak mengirim SIGINT seperti proses long-lived,
      // tapi guard ini aman untuk local dev / self-hosted.
      process.on('SIGINT', async () => {
        try {
          await mongoose.connection.close();
          console.log('🔄 MongoDB connection closed through app termination');
        } finally {
          process.exit(0);
        }
      });

      global.__mongooseListenersBound = true;
    }

    return cache.conn;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    cache.promise = null; // reset supaya panggilan berikut bisa coba lagi
    throw err;
  }
}

// Util: status koneksi (helpful untuk healthcheck/log)
export function getConnectionStatus(): string {
  if (cache.conn) {
    return mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  }
  return 'disconnected';
}

// Util: tutup koneksi (berguna untuk testing)
export async function dbDisconnect(): Promise<void> {
  if (cache.conn) {
    await mongoose.connection.close();
    cache.conn = null;
    cache.promise = null;
    global.__mongooseCache = undefined;
    global.__mongooseListenersBound = undefined;
    console.log('🔌 MongoDB connection closed');
  }
}

// ✅ kompatibel dengan import default yang sudah ada di kode kamu
export default dbConnect;
