import { normalizePayeeName, findPayee, derivePayees } from "@/lib/budget/payees";
import { isSplitTransaction } from "@/lib/budget/transactions";
import type {
  BudgetCategory,
  BudgetPlan,
  BudgetTransaction,
  PayeeRule,
  PayeeRuleMatchType,
} from "@/types/budget";

export interface PayeeRuleDraft {
  match: string;
  matchType: PayeeRuleMatchType;
  renameTo: string;
  categoryId?: string | null;
  memo?: string;
  enabled?: boolean;
}

export interface PayeeRuleApplyOptions {
  /** Bank or typed text to test. Defaults to the transaction payee. */
  matchText?: string;
  /** Always keep the imported text, even when no rule renames. */
  recordOriginal?: boolean;
  /** A category already on the row (a file column) beats the rule category. */
  preserveCategory?: boolean;
  /** Do not rename a payee the user already edited away from the bank text. */
  protectEditedPayee?: boolean;
  /** When false, a rule with no category leaves the row uncategorized. */
  allowLastUsed?: boolean;
  categories?: BudgetCategory[];
}

const MATCH_TYPES = new Set<PayeeRuleMatchType>(["contains", "starts-with", "exact"]);

export function isPayeeRuleMatchType(value: unknown): value is PayeeRuleMatchType {
  return typeof value === "string" && MATCH_TYPES.has(value as PayeeRuleMatchType);
}

export function orderedPayeeRules(rules: readonly PayeeRule[]): PayeeRule[] {
  return [...rules].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  );
}

export function payeeRuleMatches(
  rule: Pick<PayeeRule, "match" | "matchType" | "enabled">,
  text: string,
): boolean {
  if (rule.enabled === false) return false;
  const needle = normalizePayeeName(rule.match);
  const haystack = normalizePayeeName(text);
  if (!needle || !haystack) return false;
  if (rule.matchType === "exact") return haystack === needle;
  if (rule.matchType === "starts-with") return haystack.startsWith(needle);
  return haystack.includes(needle);
}

/** First enabled rule in priority order. */
export function firstMatchingPayeeRule(
  rules: readonly PayeeRule[],
  text: string,
): PayeeRule | undefined {
  return orderedPayeeRules(rules).find((rule) => payeeRuleMatches(rule, text));
}

export function payeeRuleCreateSearch(
  tx: Pick<BudgetTransaction, "payee" | "originalPayee" | "categoryId" | "type" | "splits">,
): string {
  const match = tx.originalPayee?.trim() || tx.payee;
  const params = new URLSearchParams();
  params.set("match", match);
  params.set("renameTo", tx.payee);
  const messy =
    Boolean(tx.originalPayee) &&
    normalizePayeeName(tx.originalPayee ?? "") !== normalizePayeeName(tx.payee);
  params.set("matchType", messy ? "contains" : "exact");
  if (
    tx.categoryId &&
    tx.type !== "transfer" &&
    !(tx.splits && tx.splits.length > 0)
  ) {
    params.set("categoryId", tx.categoryId);
  }
  return params.toString();
}

export function transactionPayeeSource(
  tx: Pick<BudgetTransaction, "payee" | "originalPayee">,
): string {
  const original = tx.originalPayee?.trim();
  return original || tx.payee.trim();
}

/** How many existing rows the pattern matches, including ones a higher-priority rule would win. */
export function countPayeeRuleMatches(
  transactions: readonly BudgetTransaction[],
  rule: Pick<PayeeRule, "match" | "matchType" | "enabled">,
): number {
  return transactions.reduce((count, tx) => {
    const source = transactionPayeeSource(tx);
    return payeeRuleMatches({ ...rule, enabled: true }, source) ? count + 1 : count;
  }, 0);
}

function spendingCategoryId(
  categoryId: string | null | undefined,
  categories: BudgetCategory[] | undefined,
): string | null {
  if (!categoryId) return null;
  if (!categories) return categoryId;
  const category = categories.find((entry) => entry.id === categoryId);
  if (!category || category.creditCardAccountId) return null;
  return category.id;
}

function categoryWasChosen(
  tx: Pick<BudgetTransaction, "categoryId" | "categoryManual">,
): boolean {
  if (tx.categoryManual === true) return true;
  if (tx.categoryManual === false) return false;
  return Boolean(tx.categoryId);
}

function canAssignCategory(
  tx: Pick<BudgetTransaction, "type" | "splits">,
): boolean {
  return tx.type !== "transfer" && !isSplitTransaction(tx);
}

/**
 * Rename, categorize, and remember the imported payee.
 * Category is skipped for transfers and splits, and never replaces a category
 * the user set. When no rule assigns a category, last-used category for the
 * final payee name fills an empty one.
 */
export function applyPayeeRulesToTransaction(
  tx: BudgetTransaction,
  rules: readonly PayeeRule[],
  history: readonly BudgetTransaction[],
  options: PayeeRuleApplyOptions = {},
): BudgetTransaction {
  const matchText = (options.matchText ?? tx.payee).trim();
  let originalPayee = tx.originalPayee?.trim() || undefined;
  if (options.recordOriginal && matchText) {
    originalPayee = originalPayee ?? matchText;
  }

  const rule = matchText ? firstMatchingPayeeRule(rules, matchText) : undefined;
  let payee = tx.payee.trim();
  const edited =
    options.protectEditedPayee === true &&
    normalizePayeeName(payee) !== normalizePayeeName(matchText) &&
    (!originalPayee || normalizePayeeName(payee) !== normalizePayeeName(originalPayee));

  if (rule) {
    const renameTo = rule.renameTo.trim();
    if (renameTo && !edited && normalizePayeeName(renameTo) !== normalizePayeeName(payee)) {
      originalPayee = originalPayee ?? (matchText || payee);
      payee = renameTo;
    }
  }

  let memo = tx.memo?.trim() || undefined;
  if (rule?.memo?.trim() && !memo) memo = rule.memo.trim();

  let categoryId = tx.categoryId;
  let categoryManual = tx.categoryManual;
  if (canAssignCategory(tx) && !categoryWasChosen(tx)) {
    const ruleCategory = spendingCategoryId(rule?.categoryId, options.categories);
    if (ruleCategory && !(options.preserveCategory && categoryId)) {
      categoryId = ruleCategory;
      categoryManual = false;
    } else if (!categoryId && options.allowLastUsed !== false) {
      const prior = history.filter((row) => row.id !== tx.id);
      const last = findPayee(derivePayees(prior), payee)?.lastCategoryId ?? null;
      const lastCategory = spendingCategoryId(last, options.categories);
      if (lastCategory) {
        categoryId = lastCategory;
        categoryManual = false;
      }
    }
  }

  if (
    payee === tx.payee &&
    originalPayee === tx.originalPayee &&
    memo === tx.memo &&
    categoryId === tx.categoryId &&
    categoryManual === tx.categoryManual
  ) {
    return tx;
  }

  return {
    ...tx,
    payee,
    originalPayee,
    memo,
    categoryId,
    categoryManual,
  };
}

export interface CsvImportMatch {
  transactionId: string;
  importId: string;
  payee?: string;
}

/** New CSV rows plus close-date matches. Rules run here so the parser stays pure. */
export function applyRulesToImportedTransactions<T extends BudgetPlan>(
  plan: T,
  incoming: BudgetTransaction[],
  matches: readonly CsvImportMatch[],
): T {
  const rules = plan.payeeRules ?? [];
  const categories = plan.categories;
  const matchById = new Map(matches.map((match) => [match.transactionId, match]));

  let changed = false;
  const existing = plan.transactions.map((tx) => {
    const match = matchById.get(tx.id);
    if (!match) return tx;
    const stamped: BudgetTransaction = {
      ...tx,
      importId: match.importId,
      matchedTransactionId: match.importId,
    };
    const next = match.payee
      ? applyPayeeRulesToTransaction(stamped, rules, plan.transactions, {
          matchText: match.payee,
          recordOriginal: true,
          preserveCategory: true,
          protectEditedPayee: true,
          categories,
        })
      : stamped;
    if (next !== tx) changed = true;
    return next;
  });

  const added: BudgetTransaction[] = [];
  for (const tx of incoming) {
    const next = applyPayeeRulesToTransaction(tx, rules, [...existing, ...added], {
      matchText: tx.originalPayee?.trim() || tx.payee,
      recordOriginal: true,
      preserveCategory: Boolean(tx.categoryId),
      categories,
    });
    if (next !== tx) changed = true;
    added.push(next);
  }

  if (!changed && added.length === 0) return plan;
  return { ...plan, transactions: [...existing, ...added] };
}

export interface ApplyPayeeRuleResult<T extends BudgetPlan> {
  plan: T;
  renamed: number;
  categorized: number;
}

/**
 * One-time history pass for a single rule.
 * Renames every row that this rule wins. Categorizes only uncategorized
 * rows the user did not lock. Splits and transfers keep their categories.
 */
export function applyPayeeRuleToExisting<T extends BudgetPlan>(
  plan: T,
  ruleId: string,
): ApplyPayeeRuleResult<T> {
  const rules = plan.payeeRules ?? [];
  const rule = rules.find((entry) => entry.id === ruleId);
  if (!rule || !rule.enabled) return { plan, renamed: 0, categorized: 0 };

  let renamed = 0;
  let categorized = 0;
  let changed = false;
  const transactions = plan.transactions.map((tx) => {
    const source = transactionPayeeSource(tx);
    const winner = firstMatchingPayeeRule(rules, source);
    if (!winner || winner.id !== rule.id) return tx;

    const next = applyPayeeRulesToTransaction(
      tx,
      [rule],
      plan.transactions,
      {
        matchText: source,
        recordOriginal: true,
        preserveCategory: true,
        allowLastUsed: false,
        categories: plan.categories,
      },
    );
    if (next === tx) return tx;
    changed = true;
    if (normalizePayeeName(next.payee) !== normalizePayeeName(tx.payee)) renamed += 1;
    if (next.categoryId && next.categoryId !== tx.categoryId) categorized += 1;
    return next;
  });

  if (!changed) return { plan, renamed: 0, categorized: 0 };
  return { plan: { ...plan, transactions }, renamed, categorized };
}

function nextPriority(rules: readonly PayeeRule[]): number {
  return rules.reduce((max, rule) => Math.max(max, rule.priority), -1) + 1;
}

function cleanDraft(
  draft: PayeeRuleDraft,
  categories: BudgetCategory[],
): Omit<PayeeRule, "id" | "priority"> | null {
  const match = draft.match.trim();
  const renameTo = draft.renameTo.trim();
  if (!match || !renameTo) return null;
  const memo = draft.memo?.trim() || undefined;
  return {
    match,
    matchType: isPayeeRuleMatchType(draft.matchType) ? draft.matchType : "contains",
    renameTo,
    categoryId: spendingCategoryId(draft.categoryId, categories),
    memo,
    enabled: draft.enabled !== false,
  };
}

export function addPayeeRule<T extends BudgetPlan>(
  plan: T,
  draft: PayeeRuleDraft,
  options: { id?: string; applyToExisting?: boolean } = {},
): T {
  const cleaned = cleanDraft(draft, plan.categories);
  if (!cleaned) return plan;
  const rules = plan.payeeRules ?? [];
  const rule: PayeeRule = {
    ...cleaned,
    id: options.id ?? crypto.randomUUID(),
    priority: nextPriority(rules),
  };
  const withRule = { ...plan, payeeRules: [...rules, rule] };
  if (!options.applyToExisting) return withRule;
  return applyPayeeRuleToExisting(withRule, rule.id).plan;
}

export function updatePayeeRule<T extends BudgetPlan>(
  plan: T,
  ruleId: string,
  draft: PayeeRuleDraft,
): T {
  const cleaned = cleanDraft(draft, plan.categories);
  if (!cleaned) return plan;
  const rules = plan.payeeRules ?? [];
  if (!rules.some((rule) => rule.id === ruleId)) return plan;
  return {
    ...plan,
    payeeRules: rules.map((rule) =>
      rule.id === ruleId ? { ...rule, ...cleaned } : rule,
    ),
  };
}

export function deletePayeeRule<T extends BudgetPlan>(plan: T, ruleId: string): T {
  const rules = plan.payeeRules ?? [];
  if (!rules.some((rule) => rule.id === ruleId)) return plan;
  return { ...plan, payeeRules: rules.filter((rule) => rule.id !== ruleId) };
}

export function setPayeeRuleEnabled<T extends BudgetPlan>(
  plan: T,
  ruleId: string,
  enabled: boolean,
): T {
  const rules = plan.payeeRules ?? [];
  const current = rules.find((rule) => rule.id === ruleId);
  if (!current || current.enabled === enabled) return plan;
  return {
    ...plan,
    payeeRules: rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled } : rule)),
  };
}

export function reorderPayeeRule<T extends BudgetPlan>(
  plan: T,
  ruleId: string,
  direction: "up" | "down",
): T {
  const sorted = orderedPayeeRules(plan.payeeRules ?? []);
  const index = sorted.findIndex((rule) => rule.id === ruleId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return plan;
  const next = [...sorted];
  const moved = next[index]!;
  next[index] = next[swapWith]!;
  next[swapWith] = moved;
  return {
    ...plan,
    payeeRules: next.map((rule, priority) => ({ ...rule, priority })),
  };
}

/**
 * Move every transaction (and scheduled row) from one payee onto another
 * and add an exact rename rule so the old name keeps cleaning up.
 */
export function mergePayees<T extends BudgetPlan>(
  plan: T,
  fromName: string,
  toName: string,
  createId: () => string = () => crypto.randomUUID(),
): T {
  const from = fromName.trim();
  const to = toName.trim();
  if (!from || !to || normalizePayeeName(from) === normalizePayeeName(to)) return plan;

  const fromKey = normalizePayeeName(from);
  let changed = false;
  const transactions = plan.transactions.map((tx) => {
    if (normalizePayeeName(tx.payee) !== fromKey) return tx;
    changed = true;
    return {
      ...tx,
      payee: to,
      originalPayee: tx.originalPayee?.trim() || tx.payee,
    };
  });

  const scheduledTransactions = (plan.scheduledTransactions ?? []).map((schedule) => {
    if (normalizePayeeName(schedule.payee) !== fromKey) return schedule;
    changed = true;
    return { ...schedule, payee: to };
  });

  const rules = plan.payeeRules ?? [];
  const already = rules.some(
    (rule) =>
      rule.matchType === "exact" &&
      normalizePayeeName(rule.match) === fromKey &&
      normalizePayeeName(rule.renameTo) === normalizePayeeName(to),
  );
  const lastCategory = findPayee(derivePayees(transactions), to)?.lastCategoryId ?? null;
  const payeeRules = already
    ? rules
    : [
        ...rules,
        {
          id: createId(),
          match: from,
          matchType: "exact" as const,
          renameTo: to,
          categoryId: spendingCategoryId(lastCategory, plan.categories),
          priority: nextPriority(rules),
          enabled: true,
        },
      ];

  if (!changed && already) return plan;
  return {
    ...plan,
    transactions,
    scheduledTransactions,
    payeeRules,
  };
}

export function normalizePayeeRules(
  raw: unknown,
  categories: BudgetCategory[],
): PayeeRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: PayeeRule[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Partial<PayeeRule>;
    const match = typeof row.match === "string" ? row.match.trim() : "";
    const renameTo = typeof row.renameTo === "string" ? row.renameTo.trim() : "";
    if (!match || !renameTo || !row.id) continue;
    const memo =
      typeof row.memo === "string" && row.memo.trim() ? row.memo.trim() : undefined;
    rules.push({
      id: row.id,
      match,
      matchType: isPayeeRuleMatchType(row.matchType) ? row.matchType : "contains",
      renameTo,
      categoryId: spendingCategoryId(row.categoryId, categories),
      memo,
      priority:
        typeof row.priority === "number" && Number.isFinite(row.priority)
          ? Math.floor(row.priority)
          : rules.length,
      enabled: row.enabled !== false,
    });
  }
  return rules;
}
