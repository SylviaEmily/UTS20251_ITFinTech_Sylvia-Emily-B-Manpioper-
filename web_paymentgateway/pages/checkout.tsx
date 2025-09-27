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

export const xenditService = {
  async createInvoice(input: CreateInvoiceCamel): Promise<XenditInvoice> {
    const payload = toSnake(input);

    const r = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' + Buffer.from(String(process.env.XENDIT_SECRET_KEY) + ':').toString('base64'),
      },
      body: JSON.stringify(payload),
    });

    const raw = (await r.json()) as unknown;

    if (!r.ok) {
      const err = raw as XenditErrorBody | undefined;
      const msg = err?.message ?? `Failed to create invoice (HTTP ${r.status})`;
      throw new Error(msg);
    }

    // very light runtime check
    const ok =
      typeof raw === 'object' &&
      raw !== null &&
      'id' in raw &&
      'invoice_url' in raw &&
      typeof (raw as any).id === 'string' &&
      typeof (raw as any).invoice_url === 'string';

    if (!ok) throw new Error('Unexpected response from Xendit');

    return raw as XenditInvoice;
  },
};
