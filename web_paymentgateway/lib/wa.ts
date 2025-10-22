// lib/wa.ts
export async function sendWhatsApp(target: string, message: string) {
  const token = process.env.FONNTE_TOKEN ?? "";
  if (!token) throw new Error("Missing FONNTE_TOKEN");

  const resp = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    } as HeadersInit,
    body: JSON.stringify({ target, message }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Fonnte send failed: ${resp.status} ${text}`);
  }
  return true;
}
