import { defaultOnBudgetForType } from "@/lib/budget/accounts";
import { findImportMatch } from "@/lib/budget/csv";
import { ensureCreditCardPaymentCategories } from "@/lib/budget/credit-card-payments";
import type { PlaidImportedTransaction, PlaidLinkedAccount, PlaidSyncPayload } from "@/lib/plaid/types";
import type {
  BudgetAccount,
  BudgetAccountType,
  BudgetPlan,
  BudgetTransaction,
} from "@/types/budget";

export function plaidImportId(transactionId: string): string {
  return `plaid:${transactionId}`;
}

export function plaidSignedAmountToBudget(amount: number): {
  amount: number;
  type: "inflow" | "outflow";
} | null {
  if (!Number.isFinite(amount) || amount === 0) return null;
  return {
    amount: Math.abs(amount),
    type: amount > 0 ? "outflow" : "inflow",
  };
}

export function mapPlaidAccountType(
  type: string,
  subtype: string | null | undefined,
): BudgetAccountType {
  const kind = type.trim().toLowerCase();
  const sub = (subtype ?? "").trim().toLowerCase();
  if (kind === "depository" && (sub.includes("saving") || sub === "prepaid")) {
    return sub.includes("saving") ? "savings" : "other";
  }
  if (kind === "depository") return "chequing";
  if (kind === "credit") return "credit-card";
  if (kind === "loan" && sub.includes("mortgage")) return "mortgage";
  if (kind === "loan" && (sub.includes("line") || sub.includes("credit"))) {
    return "line-of-credit";
  }
  if (kind === "investment" || kind === "brokerage") return "brokerage";
  return "other";
}

export function formatLinkedAccountName(
  name: string,
  mask?: string | null,
): string {
  const trimmed = name.trim() || "Bank account";
  const digits = mask?.trim();
  return digits ? `${trimmed} ••${digits}` : trimmed;
}

function findReusableAccount(
  accounts: BudgetAccount[],
  transactions: BudgetTransaction[],
  type: BudgetAccountType,
): BudgetAccount | undefined {
  const unused = accounts.filter(
    (account) =>
      account.type === type &&
      !account.plaidAccountId &&
      !transactions.some((tx) => tx.accountId === account.id),
  );
  return unused.length === 1 ? unused[0] : undefined;
}

export type PlaidImportResult = {
  next: BudgetPlan;
  createdAccounts: number;
  imported: number;
  matched: number;
  duplicates: number;
};

export function applyPlaidImport(
  plan: BudgetPlan,
  payload: PlaidSyncPayload,
  createId: () => string = () => crypto.randomUUID(),
): PlaidImportResult {
  const accounts = plan.accounts.map((account) => ({ ...account }));
  const accountIdByPlaid = new Map<string, string>();

  for (const incoming of payload.accounts) {
    const existing = accounts.find(
      (account) => account.plaidAccountId === incoming.plaidAccountId,
    );
    if (existing) {
      existing.plaidItemId = payload.itemId;
      existing.plaidMask = incoming.mask ?? existing.plaidMask;
      existing.lastSyncedAt = payload.syncedAt;
      accountIdByPlaid.set(incoming.plaidAccountId, existing.id);
      continue;
    }
    const type = mapPlaidAccountType(incoming.type, incoming.subtype);
    const reusable = findReusableAccount(accounts, plan.transactions, type);
    if (reusable) {
      reusable.plaidAccountId = incoming.plaidAccountId;
      reusable.plaidItemId = payload.itemId;
      reusable.plaidMask = incoming.mask ?? undefined;
      reusable.lastSyncedAt = payload.syncedAt;
      if (!reusable.name.trim() || reusable.name === "Spending") {
        reusable.name = formatLinkedAccountName(incoming.name, incoming.mask);
      }
      accountIdByPlaid.set(incoming.plaidAccountId, reusable.id);
      continue;
    }
    const created: BudgetAccount = {
      id: createId(),
      name: formatLinkedAccountName(incoming.name, incoming.mask),
      type,
      onBudget: defaultOnBudgetForType(type),
      sortOrder: accounts.length,
      plaidAccountId: incoming.plaidAccountId,
      plaidItemId: payload.itemId,
      plaidMask: incoming.mask ?? undefined,
      lastSyncedAt: payload.syncedAt,
    };
    accounts.push(created);
    accountIdByPlaid.set(incoming.plaidAccountId, created.id);
  }

  const usedMatchIds = new Set<string>();
  const nextTransactions = plan.transactions.map((tx) => ({ ...tx }));
  let imported = 0;
  let matched = 0;
  let duplicates = 0;

  for (const row of payload.transactions) {
    const signed = plaidSignedAmountToBudget(row.amount);
    const accountId = accountIdByPlaid.get(row.plaidAccountId);
    if (!signed || !accountId) continue;
    const importId = plaidImportId(row.transactionId);
    if (nextTransactions.some((tx) => tx.importId === importId)) {
      duplicates += 1;
      continue;
    }
    const matchId = findImportMatch(
      {
        date: row.date,
        amount: signed.amount,
        accountId,
        type: signed.type,
      },
      nextTransactions,
      usedMatchIds,
    );
    if (matchId) {
      usedMatchIds.add(matchId);
      const index = nextTransactions.findIndex((tx) => tx.id === matchId);
      if (index >= 0) {
        nextTransactions[index] = {
          ...nextTransactions[index]!,
          importId,
          matchedTransactionId: importId,
        };
        matched += 1;
      }
      continue;
    }
    nextTransactions.push({
      id: createId(),
      date: row.date,
      payee: (row.merchantName || row.name || "Bank transaction").trim(),
      accountId,
      categoryId: signed.type === "inflow" ? null : null,
      amount: signed.amount,
      type: signed.type,
      cleared: row.pending ? "uncleared" : "cleared",
      approved: false,
      importId,
    });
    imported += 1;
  }

  const createdAccounts = accounts.filter(
    (account) => !plan.accounts.some((current) => current.id === account.id),
  ).length;

  return {
    next: ensureCreditCardPaymentCategories({
      ...plan,
      accounts,
      transactions: nextTransactions,
    }),
    createdAccounts,
    imported,
    matched,
    duplicates,
  };
}

export function unlinkPlaidItemFromPlan(
  plan: BudgetPlan,
  itemId: string,
): BudgetPlan {
  return {
    ...plan,
    accounts: plan.accounts.map((account) =>
      account.plaidItemId === itemId
        ? {
            ...account,
            plaidAccountId: undefined,
            plaidItemId: undefined,
            plaidMask: undefined,
            lastSyncedAt: undefined,
          }
        : account,
    ),
  };
}

export function isPlaidLinkedAccount(
  account: Pick<BudgetAccount, "plaidAccountId">,
): boolean {
  return Boolean(account.plaidAccountId);
}

export type { PlaidImportedTransaction, PlaidLinkedAccount };
