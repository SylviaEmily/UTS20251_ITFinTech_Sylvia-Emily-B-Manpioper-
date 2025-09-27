// pages/api/dev/xendit-ping.ts
import type { NextApiRequest, NextApiResponse } from 'next';

function setCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  // Preflight (biar fetch dari browser nggak 405)
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Health check via GET (opsional, enak buat cek cepat)
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, note: 'Use POST to create a test invoice' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const payload = {
      external_id: `PING-${Date.now()}`,
      amount: 1000,
      currency: 'IDR',
      description: 'Ping from vercel',
      success_redirect_url: `${process.env.APP_URL || ''}/orders/ping/success`,
      failure_redirect_url: `${process.env.APP_URL || ''}/orders/ping/failed`,
    };

    const r = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' + Buffer.from(String(process.env.XENDIT_SECRET_KEY) + ':').toString('base64'),
        'User-Agent': 'vercel-ping/1.0',
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    // selalu balas JSON supaya .json() di client tidak error
    try {
      const json = JSON.parse(text);
      return res.status(r.status).json(json);
    } catch {
      return res.status(r.status).json({ ok: r.ok, raw: text });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ ok: false, error: msg });
  }
}
