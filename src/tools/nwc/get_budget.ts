import { NWCClient, BudgetRenewalPeriod } from "@getalby/sdk";

export interface GetBudgetResult {
  used_budget_in_sats?: number;
  total_budget_in_sats?: number;
  renews_at?: number;
  renewal_period?: BudgetRenewalPeriod;
}

export async function getBudget(client: NWCClient): Promise<GetBudgetResult> {
  const budget = await client.getBudget();

  if (!("used_budget" in budget)) {
    return {};
  }

  return {
    used_budget_in_sats: Math.floor(budget.used_budget / 1000),
    total_budget_in_sats: budget.total_budget
      ? Math.floor(budget.total_budget / 1000)
      : undefined,
    renews_at: budget.renews_at,
    renewal_period: budget.renewal_period,
  };
}
