// lib/xendit.ts - DENGAN CONVERSION CAMELCASE → UNDERSCORE

export interface XenditInvoiceRequest {
  // CAMELCASE untuk TypeScript interface
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
  external_id: string;        // underscore untuk response (sesuai Xendit)
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'FAILED';
  amount: number;
  payer_email: string;        // underscore
  description: string;
  invoice_url: string;        // underscore
  expiry_date: string;        // underscore
  created: string;
  updated: string;
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
      // CONVERT camelCase to underscore untuk Xendit API
      const apiData = {
        external_id: data.externalID,           // camelCase → underscore
        amount: data.amount,
        payer_email: data.payerEmail,           // camelCase → underscore
        description: data.description,
        success_redirect_url: data.successRedirectURL,  // camelCase → underscore
        failure_redirect_url: data.failureRedirectURL,  // camelCase → underscore
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
        const errorData = await response.json();
        console.error('Xendit API error:', errorData);
        throw new Error(errorData.message || `Xendit API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Xendit response:', result);
      return result;

    } catch (error: any) {
      console.error('Xendit createInvoice error:', error);
      throw new Error(`Failed to create Xendit invoice: ${error.message}`);
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

      return await response.json();
    } catch (error: any) {
      console.error('Xendit getInvoice error:', error);
      throw new Error(`Failed to get Xendit invoice: ${error.message}`);
    }
  }
}

export const xenditService = new XenditService();