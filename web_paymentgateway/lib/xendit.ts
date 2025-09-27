// lib/xendit.ts
type CreateInvoiceCamel = {
  externalID: string;
  amount: number;
  payerEmail?: string;
  description?: string;
  successRedirectURL?: string;
  failureRedirectURL?: string;
  currency?: 'IDR';
  items?: Array<{ name: string; quantity: number; price: number }>;
  idempotencyKey?: string; // optional
  timeoutMs?: number;      // optional
};

type XenditCreateInvoiceRequest = {
  external_id: string;
  amount: number;
  payer_email?: string;
  description?: string;
  success_redirect_url?: string;
  failure_redirect_url?: string;
  currency?: 'IDR';
  items?: Array<{ name: string; quantity: number; price: number }>;
};

export type XenditInvoice = {
  id: string;
  invoice_url: string;
  status?: 'PENDING' | 'PAID' | 'EXPIRED' | 'VOIDED' | 'FAILED';
};

export type XenditErrorBody = { message?: string; error_code?: string; [k: string]: unknown };

function toSnake(c: CreateInvoiceCamel): XenditCreateInvoiceRequest {
  return {
    external_id: c.externalID,
    amount: c.amount,
    payer_email: c.payerEmail,
    description: c.description,
    success_redirect_url: c.successRedirectURL,
    failure_redirect_url: c.failureRedirectURL,
    currency: c.currency ?? 'IDR',
    items: c.items,
  };
}

// ✅ type guard tanpa any
function isXenditInvoice(x: unknown): x is XenditInvoice {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.invoice_url === 'string';
}

export const xenditService = {
  async createInvoice(input: CreateInvoiceCamel): Promise<XenditInvoice> {
    const payload = toSnake(input);

    // timeout support (opsional)
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);

    try {
      const r = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:
            'Basic ' + Buffer.from(String(process.env.XENDIT_SECRET_KEY) + ':').toString('base64'),
          ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
          'User-Agent': 'web_paymentgateway/1.0 (+Next.js)',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const raw: unknown = await r.json();

      if (!r.ok) {
        const err = raw as XenditErrorBody | undefined;
        const msg = err?.message ?? `Failed to create invoice (HTTP ${r.status})`;
        throw new Error(msg);
      }

      if (!isXenditInvoice(raw)) {
        throw new Error('Unexpected response from Xendit');
      }
      return raw;
    } finally {
      clearTimeout(to);
    }
  },
};
