import mongoose from 'mongoose';

type Cache = { 
  conn: typeof mongoose | null; 
  promise: Promise<typeof mongoose> | null; 
};

declare global { 
  var __mongooseCache: Cache | undefined; 
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const cache: Cache = global.__mongooseCache ?? { conn: null, promise: null };

export async function dbConnect(): Promise<typeof mongoose> {
  // Jika sudah connected, return connection yang ada
  if (cache.conn) {
    return cache.conn;
  }

  // Jika belum ada promise connection, buat baru
  if (!cache.promise) {
    const uri = requireEnv('MONGODB_URI');
    
    // Optimasi configuration untuk Vercel dan MongoDB Atlas (FIXED OPTIONS)
    const options: mongoose.ConnectOptions = {
      // Optimasi untuk serverless environment (Vercel)
      bufferCommands: false, // Disable buffering untuk serverless
      maxPoolSize: 10,       // Maximum connection pool size
      minPoolSize: 1,        // Minimum connection pool size
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      serverSelectionTimeoutMS: 30000, // Keep trying to send operations for 30 seconds
      family: 4, // Use IPv4, skip trying IPv6
      
      // MongoDB Atlas specific options
      retryWrites: true,
      w: 'majority'
    };

    console.log('🔗 Connecting to MongoDB...');
    
    cache.promise = mongoose.connect(uri, options)
      .then((mongooseInstance) => {
        console.log('✅ MongoDB connected successfully');
        return mongooseInstance;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        // Reset cache pada error
        cache.promise = null;
        throw error;
      });
  }

  try {
    cache.conn = await cache.promise;
    global.__mongooseCache = cache;
    
    // Handle connection events untuk monitoring
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected from MongoDB');
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 MongoDB connection closed through app termination');
      process.exit(0);
    });

    return cache.conn;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    cache.promise = null; // Reset cache pada error
    throw error;
  }
}

// Utility function untuk check connection status
export function getConnectionStatus(): string {
  if (cache.conn) {
    return mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  }
  return 'disconnected';
}

// Utility function untuk close connection (useful for testing)
export async function dbDisconnect(): Promise<void> {
  if (cache.conn) {
    await mongoose.connection.close();
    cache.conn = null;
    cache.promise = null;
    global.__mongooseCache = undefined;
    console.log('🔌 MongoDB connection closed');
  }
}
