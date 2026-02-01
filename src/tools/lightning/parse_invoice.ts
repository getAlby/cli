import { Invoice } from "@getalby/lightning-tools";

export interface ParseInvoiceParams {
  invoice: string;
}

export interface ParseInvoiceResult {
  paymentHash: string;
  amount_in_sats: number;
  description: string | null;
  timestamp: number;
  expiry: number | undefined;
  paymentRequest: string;
}

export function parseInvoice(params: ParseInvoiceParams): ParseInvoiceResult {
  const { satoshi, ...invoice } = new Invoice({ pr: params.invoice });

  return {
    ...invoice,
    amount_in_sats: satoshi,
  };
}
