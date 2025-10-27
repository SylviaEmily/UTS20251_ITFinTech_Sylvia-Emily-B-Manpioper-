// pages/api/admin-proxy/[...slug].ts
import type { NextApiRequest, NextApiResponse } from "next";

function headerToString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return "Unknown error"; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Date.now();

  const ADMIN_KEY = process.env.ADMIN_INVITE_KEY;
  if (!ADMIN_KEY) {
    console.error(`❌ [${requestId}] ADMIN_INVITE_KEY is not set`);
    res.status(500).json({ error: "ADMIN_INVITE_KEY is not set" });
    return;
  }

  // Base URL (dev/prod)
  const fwdProto = headerToString(req.headers["x-forwarded-proto"]);
  const fwdHost  = headerToString(req.headers["x-forwarded-host"]);
  const host     = fwdHost ?? headerToString(req.headers.host) ?? "localhost:3000";
  const proto    = fwdProto ?? (host.startsWith("localhost") ? "http" : "https");
  const base     = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;

  // Build path from catch-all slug
  const slugParam = req.query.slug;
  const slugParts = Array.isArray(slugParam) ? slugParam : [];
  const path = slugParts.length ? `/${slugParts.join("/")}` : "";

  // Rebuild query string (exclude "slug")
  const qs = new URLSearchParams();
  Object.entries(req.query).forEach(([k, v]) => {
    if (k === "slug") return;
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
    else if (typeof v === "string") qs.append(k, v);
  });
  const query = qs.size ? `?${qs.toString()}` : "";

  const upstreamUrl = `${base}/api/admin${path}${query}`;

  // Prepare fetch options
  const method = req.method ?? "GET";
  const hasBody = !["GET", "HEAD"].includes(method);
  const fetchHeaders: Record<string, string> = { "x-admin-key": ADMIN_KEY };
  if (hasBody) fetchHeaders["content-type"] = "application/json";

  const body =
    hasBody
      ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}))
      : undefined;

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers: fetchHeaders,
      body,
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") || "";
    res.status(upstream.status);

    if (contentType.includes("application/json")) {
      // Parse & re-send as clean JSON (jangan mirror content-encoding/length)
      let payload: unknown;
      try {
        payload = await upstream.json();
      } catch {
        payload = { error: "Upstream returned invalid JSON" };
      }
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.json(payload);
      return;
    }

    // Fallback non-JSON
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (contentType) res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "no-store");
    res.send(buf);
  } catch (err) {
    console.error(`  ❌ [${requestId}] Proxy error:`, err);
    res.status(502).json({ error: "Proxy error", message: getErrorMessage(err) });
  }
}
