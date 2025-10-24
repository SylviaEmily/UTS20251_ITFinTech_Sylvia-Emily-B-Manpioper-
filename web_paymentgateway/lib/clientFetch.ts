// lib/clientFetch.ts
export async function clientFetchJSON<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const r = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  // Try to parse JSON safely (even on errors)
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    /* ignore invalid JSON */
  }

  // Extract message from unknown JSON
  const getMessage = (obj: unknown): string | null => {
    if (obj && typeof obj === "object") {
      const rec = obj as Record<string, unknown>;
      if (typeof rec.message === "string") return rec.message;
      if (typeof rec.error === "string") return rec.error;
    }
    return null;
  };

  if (!r.ok) {
    const msg = getMessage(body) ?? `Request failed: ${r.status}`;
    throw new Error(msg);
  }

  return body as T;
}
