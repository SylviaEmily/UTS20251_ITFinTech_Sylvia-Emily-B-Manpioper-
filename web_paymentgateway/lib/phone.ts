// lib/phone.ts
export function normalizePhone(input: string) {
  let p = (input || "").toString().trim();
  p = p.replace(/\D/g, "");        // keep digits only
  if (p.startsWith("+62")) p = p.slice(1);
  if (p.startsWith("08")) p = "62" + p.slice(1);
  if (p.startsWith("0")) p = "62" + p.slice(1);
  return p;
}
