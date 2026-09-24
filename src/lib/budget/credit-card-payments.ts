import {
  accountById,
  isCreditCardPaymentAccount,
  isOnBudgetAccount,
} from "@/lib/budget/accounts";
import { removeCategoryFromBudget } from "@/lib/budget/category-mutations";
import { isSplitTransaction } from "@/lib/budget/transactions";
import type {
  BudgetAccount,
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetPlan,
  BudgetTransaction,
} from "@/types/budget";

export const CREDIT_CARD_PAYMENTS_GROUP_NAME = "Credit Card Payments";

export function isCreditCardPaymentsGroup(
  group: Pick<BudgetCategoryGroup, "kind">,
): boolean {
  return group.kind === "credit-card-payments";
}

export function isPaymentCategory(
  category: Pick<BudgetCategory, "creditCardAccountId">,
): boolean {
  return Boolean(category.creditCardAccountId);
}

export function userAssignableCategories(
  categories: BudgetCategory[],
): BudgetCategory[] {
  return categories.filter((category) => !isPaymentCategory(category));
}

export function paymentCategoryForAccount(
  categories: BudgetCategory[],
  accountId: string,
): BudgetCategory | undefined {
  return categories.find((category) => category.creditCardAccountId === accountId);
}

export function paymentAccountIdForCategory(
  categories: BudgetCategory[],
  categoryId: string,
): string | undefined {
  return categories.find((category) => category.id === categoryId)
    ?.creditCardAccountId;
}

/** Portion of a card outflow that is categorized to a spending envelope. */
export function categorizedCardOutflowAmount(tx: BudgetTransaction): number {
  if (tx.type !== "outflow") return 0;
  if (isSplitTransaction(tx)) {
    return (tx.splits ?? [])
      .filter((line) => Boolean(line.categoryId))
      .reduce((sum, line) => sum + line.amount, 0);
  }
  return tx.categoryId ? tx.amount : 0;
}

function isOnBudgetCashAccount(account: BudgetAccount | undefined): boolean {
  if (!account || !isOnBudgetAccount(account)) return false;
  return !isCreditCardPaymentAccount(account);
}

/**
 * Activity that reduces payment-category available.
 *
 *   available = assigned − activity − credit overspend
 *   activity  = payments − categorized card charges + categorized returns
 *               − card spending that leaves the budget
 *
 * A categorized card purchase raises available (dollars moved here).
 * An uncategorized card charge, including a starting balance owed, does not.
 * A transfer *to* the card lowers available.
 * A cash advance (card → on-budget cash) does not fund this envelope.
 * An uncategorized card inflow is handled separately, and only up to the
 * dollars this envelope already holds.
 */
export function getPaymentCategoryActivity(
  tx: BudgetTransaction,
  creditCardAccountId: string,
  accounts?: BudgetAccount[],
): number {
  if (tx.type === "transfer") {
    if (tx.transferAccountId === creditCardAccountId) return tx.amount;
    if (tx.accountId !== creditCardAccountId) return 0;
    const destination = accountById(accounts, tx.transferAccountId);
    if (isOnBudgetCashAccount(destination)) return 0;
    if (destination && isCreditCardPaymentAccount(destination)) return 0;
    if (destination && !isOnBudgetAccount(destination)) return -tx.amount;
    return 0;
  }
  if (tx.accountId !== creditCardAccountId) return 0;
  if (tx.type === "outflow") return -categorizedCardOutflowAmount(tx);
  if (tx.type === "inflow") return tx.categoryId ? tx.amount : 0;
  return 0;
}

export function sumTransfersToCard(
  transactions: BudgetTransaction[],
  creditCardAccountId: string,
  monthKey: string,
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.date.slice(0, 7) > monthKey) return sum;
    if (tx.type !== "transfer" || tx.transferAccountId !== creditCardAccountId) {
      return sum;
    }
    return sum + tx.amount;
  }, 0);
}

export function sumUncategorizedCardInflows(
  transactions: BudgetTransaction[],
  creditCardAccountId: string,
  monthKey: string,
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.date.slice(0, 7) > monthKey) return sum;
    if (tx.type !== "inflow" || tx.accountId !== creditCardAccountId) return sum;
    if (tx.categoryId) return sum;
    return sum + tx.amount;
  }, 0);
}

function paymentCategoryName(accountName: string): string {
  return `${accountName} Payment`;
}

function removeCategories(
  plan: BudgetPlan,
  categoryIds: string[],
): BudgetPlan {
  return categoryIds.reduce(
    (next, categoryId) => removeCategoryFromBudget(next, categoryId) as BudgetPlan,
    plan,
  );
}

/**
 * Each credit-card / line-of-credit account gets one payment category in a
 * system "Credit Card Payments" group. Existing user categories and
 * assignments are left alone.
 */
export function ensureCreditCardPaymentCategories(plan: BudgetPlan): BudgetPlan {
  const liabilities = plan.accounts.filter((account) =>
    isCreditCardPaymentAccount(account),
  );
  const liabilityIds = new Set(liabilities.map((account) => account.id));

  let next = plan;
  let groups = [...plan.categoryGroups];
  let categories = [...plan.categories];
  let changed = false;

  const orphanIds = categories
    .filter(
      (category) =>
        category.creditCardAccountId &&
        !liabilityIds.has(category.creditCardAccountId),
    )
    .map((category) => category.id);

  if (orphanIds.length > 0) {
    next = removeCategories(next, orphanIds);
    groups = [...next.categoryGroups];
    categories = [...next.categories];
    changed = true;
  }

  let paymentGroup = groups.find(isCreditCardPaymentsGroup);

  if (liabilities.length === 0) {
    if (paymentGroup) {
      const leftoverIds = categories
        .filter((category) => category.groupId === paymentGroup!.id)
        .map((category) => category.id);
      if (leftoverIds.length > 0) {
        next = removeCategories(next, leftoverIds);
        categories = [...next.categories];
        groups = [...next.categoryGroups];
      }
      groups = groups.filter((group) => group.id !== paymentGroup!.id);
      return {
        ...next,
        categoryGroups: groups,
        categories,
      };
    }
    return changed ? { ...next, categoryGroups: groups, categories } : plan;
  }

  if (!paymentGroup) {
    paymentGroup = {
      id: crypto.randomUUID(),
      name: CREDIT_CARD_PAYMENTS_GROUP_NAME,
      sortOrder: Math.min(0, ...groups.map((group) => group.sortOrder), 0) - 1,
      kind: "credit-card-payments",
    };
    groups = [paymentGroup, ...groups];
    changed = true;
  } else if (paymentGroup.name !== CREDIT_CARD_PAYMENTS_GROUP_NAME) {
    groups = groups.map((group) =>
      group.id === paymentGroup!.id
        ? { ...group, name: CREDIT_CARD_PAYMENTS_GROUP_NAME }
        : group,
    );
    paymentGroup = groups.find(isCreditCardPaymentsGroup)!;
    changed = true;
  }

  for (const account of liabilities) {
    const existing = categories.find(
      (category) => category.creditCardAccountId === account.id,
    );
    const expectedName = paymentCategoryName(account.name);
    if (!existing) {
      categories = [
        ...categories,
        {
          id: crypto.randomUUID(),
          groupId: paymentGroup.id,
          name: expectedName,
          sortOrder: account.sortOrder,
          creditCardAccountId: account.id,
        },
      ];
      changed = true;
      continue;
    }

    if (
      existing.name !== expectedName ||
      existing.groupId !== paymentGroup.id ||
      existing.sortOrder !== account.sortOrder
    ) {
      categories = categories.map((category) =>
        category.id === existing.id
          ? {
              ...category,
              name: expectedName,
              groupId: paymentGroup.id,
              sortOrder: account.sortOrder,
            }
          : category,
      );
      changed = true;
    }
  }

  if (!changed) return plan;

  return {
    ...next,
    categoryGroups: groups,
    categories,
  };
}

export function sortCategoryGroupsForBudget(
  groups: BudgetCategoryGroup[],
): BudgetCategoryGroup[] {
  return [...groups].sort((a, b) => {
    const aPayment = isCreditCardPaymentsGroup(a);
    const bPayment = isCreditCardPaymentsGroup(b);
    if (aPayment !== bPayment) return aPayment ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}
