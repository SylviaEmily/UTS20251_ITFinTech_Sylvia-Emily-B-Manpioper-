// pages/api/admin-proxy/[...slug].ts
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: { bodyParser: false }, // supaya body dibaca mentah & diteruskan apa adanya
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug = [] } = req.query as { slug: string[] };
  const adminKey = process.env.ADMIN_INVITE_KEY;
  if (!adminKey) {
    return res.status(500).json({ error: "ADMIN_INVITE_KEY is not set" });
  }

  // rakit URL upstream, pertahankan querystring
  const qs = new URLSearchParams(req.query as any);
  qs.delete("slug"); // hapus param dinamis
  const path = slug.join("/");
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const upstreamUrl = `${base}/api/admin/${path}${qs.toString() ? `?${qs.toString()}` : ""}`;

  // cloning body stream (POST/PUT/PATCH)
  const chunks: Uint8Array[] = [];
  if (req.method !== "GET" && req.method !== "HEAD") {
    for await (const chunk of req) chunks.push(chunk as Uint8Array);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  // forward request ke admin api + tambahkan x-admin-key
  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers: {
      ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => k !== "host")),
      "x-admin-key": adminKey,
    } as any,
    body,
  });

  // forward status, headers, dan body ke client
  res.status(upstream.status);
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() === "transfer-encoding") return;
    res.setHeader(k, v);
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}
