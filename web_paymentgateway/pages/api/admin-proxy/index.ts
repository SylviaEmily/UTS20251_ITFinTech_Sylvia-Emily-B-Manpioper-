// pages/api/admin-proxy/index.ts
import type { NextApiRequest, NextApiResponse } from "next";

/** Safely derive an error message from unknown */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

/** Normalize header value (string | string[] | undefined) to string | undefined */
function headerToString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ADMIN_KEY = process.env.ADMIN_INVITE_KEY;
  if (!ADMIN_KEY) {
    res.status(500).json({ error: "ADMIN_INVITE_KEY is not set" });
    return;
  }

  const proto = headerToString(req.headers["x-forwarded-proto"]) ?? "http";
  const host = headerToString(req.headers.host) ?? "localhost:3000";
  const base = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
  const upstreamUrl = `${base}/api/admin`; // list/create products

  const method = req.method ?? "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody
    ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}))
    : undefined;

  const headers: Record<string, string> = { "x-admin-key": ADMIN_KEY };
  if (hasBody) headers["content-type"] = "application/json";

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        res.setHeader(key, value);
      }
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err: unknown) {
    res.status(502).json({ error: "Proxy error", message: getErrorMessage(err) });
  }
}
