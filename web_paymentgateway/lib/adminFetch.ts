// lib/adminFetch.ts (server-only file)
export async function adminFetch(input: string, init: RequestInit = {}) {
  const url = input.startsWith('http')
    ? input
    : `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}${input}`;

  const headers = new Headers(init.headers);
  headers.set('x-admin-key', process.env.ADMIN_INVITE_KEY!);

  // Avoid caching admin data
  return fetch(url, { ...init, headers, cache: 'no-store' });
}
