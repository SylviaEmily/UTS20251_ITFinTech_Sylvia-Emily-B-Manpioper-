import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const t = (process.env.XENDIT_CALLBACK_TOKEN || '');
  const masked = t ? `${t.slice(0,4)}...${t.slice(-4)} (len=${t.length})` : '(empty)';
  res.status(200).json({ ok: true, expectedHeader: 'x-callback-token', tokenMasked: masked });
}
