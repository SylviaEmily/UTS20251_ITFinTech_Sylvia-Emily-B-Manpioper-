// lib/xendit.ts - FIXED VERSION
export interface XenditInvoiceRequest {
  externalID: string;
  amount: number;
  payerEmail?: string;
  description: string;
  successRedirectURL?: string;
  failureRedirectURL?: string;
  currency?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  amount: number;
  payer_email: string;
  description: string;
  invoice_url: string;
  expiry_date: string;
  created: string;
  updated: string;
}

export interface XenditError {
  message: string;
  code?: string;
}

export class XenditService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.XENDIT_SECRET_KEY || '';
    if (!this.secretKey) {
      console.warn('XENDIT_SECRET_KEY is not set');
    }
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(this.secretKey + ':').toString('base64');
  }

  async createInvoice(data: XenditInvoiceRequest): Promise<XenditInvoiceResponse> {
    try {
      // Convert camelCase to underscore untuk Xendit API
      const apiData = {
        external_id: data.externalID,
        amount: data.amount,
        payer_email: data.payerEmail,
        description: data.description,
        success_redirect_url: data.successRedirectURL,
        failure_redirect_url: data.failureRedirectURL,
        currency: data.currency || 'IDR',
        items: data.items || [],
      };

      console.log('Sending to Xendit:', JSON.stringify(apiData, null, 2));

      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
        },
        body: JSON.stringify(apiData),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        const errorMessage = this.getErrorMessage(errorData);
        console.error('Xendit API error:', errorData);
        throw new Error(errorMessage || `Xendit API error: ${response.status}`);
      }

      const result: XenditInvoiceResponse = await response.json();
      console.log('Xendit response:', result);
      return result;

    } catch (error: unknown) {
      console.error('Xendit createInvoice error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to create Xendit invoice: ${errorMessage}`);
    }
  }

  async getInvoice(invoiceId: string): Promise<XenditInvoiceResponse> {
    try {
      const response = await fetch(`https://api.xendit.co/v2/invoices/${invoiceId}`, {
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      if (!response.ok) {
        throw new Error(`Xendit API error: ${response.status}`);
      }

      const result: XenditInvoiceResponse = await response.json();
      return result;
    } catch (error: unknown) {
      console.error('Xendit getInvoice error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to get Xendit invoice: ${errorMessage}`);
    }
  }

  private getErrorMessage(errorData: unknown): string {
    if (typeof errorData === 'object' && errorData !== null) {
      if ('message' in errorData && typeof errorData.message === 'string') {
        return errorData.message;
      }
      if ('error' in errorData && typeof errorData.error === 'string') {
        return errorData.error;
      }
    }
    return 'Unknown Xendit error';
  }
}

export const xenditService = new XenditService();