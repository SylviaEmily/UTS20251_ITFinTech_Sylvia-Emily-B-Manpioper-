import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug = [] } = req.query as { slug?: string[] };
  const adminKey = process.env.ADMIN_INVITE_KEY;
  if (!adminKey) {
    res.status(500).json({ error: "ADMIN_INVITE_KEY is not set" });
    return;
  }

  // Build upstream URL
  const qs = new URLSearchParams(req.query as Record<string, string>);
  qs.delete("slug");
  const path = Array.isArray(slug) ? slug.join("/") : slug;
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const upstreamUrl = `${base}/api/admin/${path}${qs.size ? `?${qs.toString()}` : ""}`;

  // Read body if needed
  const chunks: Uint8Array[] = [];
  if (req.method && !["GET", "HEAD"].includes(req.method)) {
    for await (const chunk of req) {
      chunks.push(chunk as Uint8Array);
    }
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;

  // Clone headers without host
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === "host") continue;
    if (typeof value === "string") headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value.join(",");
  }
  headers["x-admin-key"] = adminKey;

  // Forward request
  const upstream = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
  });

  // Relay response
  res.status(upstream.status);
  upstream.headers.forEach((v, k) => {
    if (k.toLowerCase() === "transfer-encoding") return;
    res.setHeader(k, v);
  });

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.send(buffer);
}
