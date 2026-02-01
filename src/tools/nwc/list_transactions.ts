import { NWCClient, Nip47Transaction } from "@getalby/sdk";

export interface ListTransactionsParams {
  from?: number;
  until?: number;
  limit?: number;
  offset?: number;
  type?: "incoming" | "outgoing";
  unpaid?: boolean;
}

export interface TransactionResult {
  type: string;
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash: string;
  amount_in_sats: number;
  fees_paid_in_sats?: number;
  created_at: number;
  expires_at?: number;
  settled_at?: number;
  metadata?: Record<string, unknown>;
}

export interface ListTransactionsResult {
  transactions: TransactionResult[];
}

export async function listTransactions(
  client: NWCClient,
  params: ListTransactionsParams
): Promise<ListTransactionsResult> {
  const result = await client.listTransactions({
    from: params.from,
    until: params.until,
    limit: params.limit,
    type: params.type,
    unpaid: params.unpaid,
    offset: params.offset,
  });

  return {
    ...result,
    transactions: result.transactions.map(
      ({ amount, fees_paid, ...transaction }: Nip47Transaction) => ({
        ...transaction,
        amount_in_sats: Math.floor(amount / 1000),
        fees_paid_in_sats:
          typeof fees_paid === "number" ? Math.ceil(fees_paid / 1000) : undefined,
      })
    ),
  };
}
