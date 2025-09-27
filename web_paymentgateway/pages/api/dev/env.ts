import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    env: {
      hasMongoUri: Boolean(process.env.MONGODB_URI),
      hasXenditKey: Boolean(process.env.XENDIT_SECRET_KEY),
      hasAppUrl: Boolean(process.env.APP_URL),
      mode: process.env.XENDIT_SECRET_KEY?.startsWith('xnd_development_') ? 'TEST'
           : process.env.XENDIT_SECRET_KEY?.startsWith('xnd_live_') ? 'LIVE'
           : 'UNKNOWN'
    }
  });
}
