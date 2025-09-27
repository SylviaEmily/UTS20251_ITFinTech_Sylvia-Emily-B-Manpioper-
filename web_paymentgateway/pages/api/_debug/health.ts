import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '@/lib/mongodb';

const XENDIT_BASE = 'https://api.xendit.co/v2/invoices';

function redacted(v?: string) {
  if (!v) return 'MISSING';
  if (v.length <= 6) return '***';
  return v.slice(0, 6) + '***';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const result: any = {
    env: {
      MONGODB_URI: redacted(process.env.MONGODB_URI),
      XENDIT_SECRET_KEY: redacted(process.env.XENDIT_SECRET_KEY),
      XENDIT_CALLBACK_TOKEN: process.env.XENDIT_CALLBACK_TOKEN ? 'SET' : 'MISSING',
      APP_URL: process.env.APP_URL || 'MISSING',
    },
    mongodb: { connected: false, error: null as null | string },
    xendit: { ok: false, error: null as null | string },
  };

  // 1) Test koneksi Mongo
  try {
    const conn = await dbConnect();
    result.mongodb.connected = !!conn?.connection?.readyState; // 1 = connected
  } catch (e: unknown) {
    result.mongodb.error = e instanceof Error ? e.message : 'Unknown error';
  }

  // 2) Test panggil Xendit (POST invoice kecil di test mode)
  try {
    if (!process.env.XENDIT_SECRET_KEY) throw new Error('Missing XENDIT_SECRET_KEY');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization:
        'Basic ' + Buffer.from(`${process.env.XENDIT_SECRET_KEY}:`).toString('base64'),
    };
    const external_id = `health_${Date.now()}`;
    const callback_url = `${process.env.APP_URL}/api/xendit/webhook`;
    const resp = await fetch(XENDIT_BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        external_id,
        amount: 1000,
        currency: 'IDR',
        description: 'healthcheck',
        callback_url,
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${t}`);
    }
    const data = await resp.json();
    result.xendit.ok = !!data?.id;
  } catch (e: unknown) {
    result.xendit.error = e instanceof Error ? e.message : 'Unknown error';
  }

  res.status(200).json(result);
}
