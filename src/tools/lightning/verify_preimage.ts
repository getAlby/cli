import { Invoice } from "@getalby/lightning-tools";

export interface VerifyPreimageParams {
  invoice: string;
  preimage: string;
}

export interface VerifyPreimageResult {
  valid: boolean;
  payment_hash: string;
}

export function verifyPreimage(
  params: VerifyPreimageParams
): VerifyPreimageResult {
  const invoice = new Invoice({ pr: params.invoice });
  const valid = invoice.validatePreimage(params.preimage);

  return {
    valid,
    payment_hash: invoice.paymentHash,
  };
}
