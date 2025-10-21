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

export async function sendWhatsApp({ to, message }: SendWAOptions) {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.error("FONNTE_TOKEN missing");
    return { ok: false, error: "Missing token" };
  }

  const target = normalizePhone(to);
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token, // harus string non-undefined
      "Content-Type": "application/json",
    } as HeadersInit,
    body: JSON.stringify({
      target,
      message,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("WA send failed:", res.status, t);
    return { ok: false, error: `HTTP ${res.status}` };
  }
  return { ok: true };
}
