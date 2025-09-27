// lib/payments/xendit/create-invoice.ts
export type CreateInvoiceParams = {
  externalId: string;
  amount: number;
  currency?: string;          // default: 'IDR'
  payerEmail?: string;        // optional
  description?: string;
  callbackUrl: string;        // webhook endpoint kamu
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  idempotencyKey?: string;    // optional, untuk cegah duplikasi
};

export type XenditInvoice = {
  id: string;
  external_id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_url: string;
  payment_method?: string | null;
  paid_at?: string | null;
  // tambahkan field lain jika perlu
};

const XENDIT_BASE = 'https://api.xendit.co/v2/invoices';

export async function createXenditInvoice(params: CreateInvoiceParams): Promise<XenditInvoice> {
  const {
    externalId,
    amount,
    currency = 'IDR',
    payerEmail,
    description,
    callbackUrl,
    successRedirectUrl,
    failureRedirectUrl,
    idempotencyKey,
  } = params;

  if (!process.env.XENDIT_SECRET_KEY) {
    throw new Error('Missing XENDIT_SECRET_KEY env');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer
      .from(process.env.XENDIT_SECRET_KEY + ':')
      .toString('base64'),
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const body = {
    external_id: externalId,
    amount,
    currency,
    payer_email: payerEmail || undefined,
    description,
    callback_url: callbackUrl,
    success_redirect_url: successRedirectUrl,
    failure_redirect_url: failureRedirectUrl,
  };

  const resp = await fetch(XENDIT_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Xendit error (${resp.status}): ${errText}`);
  }

  return resp.json() as Promise<XenditInvoice>;
}
