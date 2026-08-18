import { isLiabilityAccount } from "@/lib/budget/accounts";
import { removeCategoryFromBudget } from "@/lib/budget/category-mutations";
import type {
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

/**
 * Activity that reduces payment-category available.
 *
 *   available = assigned − activity
 *   activity  = payments − card charges (+ refunds, − cash advances)
 *
 * A card spend therefore raises available (money moved to the payment category).
 * A transfer *to* the card lowers available and must not also count as expense.
 */
export function getPaymentCategoryActivity(
  tx: BudgetTransaction,
  creditCardAccountId: string,
): number {
  if (tx.type === "transfer") {
    if (tx.transferAccountId === creditCardAccountId) return tx.amount;
    if (tx.accountId === creditCardAccountId) return -tx.amount;
    return 0;
  }
  if (tx.accountId !== creditCardAccountId) return 0;
  if (tx.type === "outflow") return -tx.amount;
  if (tx.type === "inflow") return tx.amount;
  return 0;
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
    isLiabilityAccount(account.type),
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
