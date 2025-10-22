// lib/whatsapp.ts
export function normalizePhone(input: string) {
  let p = (input || "").replace(/\D/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("08")) p = "62" + p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  return p;
}

type SendWAOptions = {
  to: string;
  message: string;
};

type SendResult =
  | { ok: true }
  | { ok: false; error: string };

async function postJSON(url: string, init: RequestInit & { timeoutMs?: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 10_000); // 10s
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsApp({ to, message }: SendWAOptions): Promise<SendResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.error("[WA] FONNTE_TOKEN missing");
    return { ok: false, error: "Missing token" };
  }

  const target = normalizePhone(to);
  if (!target) {
    console.error("[WA] Target phone is empty");
    return { ok: false, error: "Empty phone" };
  }

  // Retry ringan: 2 percobaan agar toleran gangguan jaringan singkat
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await postJSON("https://api.fonnte.com/send", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        } as HeadersInit,
        body: JSON.stringify({ target, message }),
        timeoutMs: 10_000,
      });

      if (!r.ok) {
        console.error(`[WA] send failed (try ${attempt}) status=${r.status} body=${r.text}`);
      } else {
        console.info(`[WA] sent to ${target} (try ${attempt})`);
        return { ok: true };
      }
    } catch (err) {
      console.error(`[WA] exception (try ${attempt}):`, err);
    }
  }

  return { ok: false, error: "Failed after retries" };
}
