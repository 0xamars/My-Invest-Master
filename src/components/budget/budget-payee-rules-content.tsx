"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  BudgetEmptyState,
  BudgetPageHeader,
  BudgetPanel,
} from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudget } from "@/contexts/budget-context";
import { userAssignableCategories } from "@/lib/budget/credit-card-payments";
import { derivePayees } from "@/lib/budget/payees";
import {
  countPayeeRuleMatches,
  isPayeeRuleMatchType,
  orderedPayeeRules,
} from "@/lib/budget/payee-rules";
import type { PayeeRule, PayeeRuleMatchType } from "@/types/budget";

const MATCH_TYPE_LABEL: Record<PayeeRuleMatchType, string> = {
  contains: "Contains",
  "starts-with": "Starts with",
  exact: "Exact",
};

interface RuleDraft {
  match: string;
  matchType: PayeeRuleMatchType;
  renameTo: string;
  categoryId: string;
  memo: string;
  enabled: boolean;
  applyToExisting: boolean;
}

function emptyDraft(): RuleDraft {
  return {
    match: "",
    matchType: "contains",
    renameTo: "",
    categoryId: "none",
    memo: "",
    enabled: true,
    applyToExisting: false,
  };
}

function draftFromRule(rule: PayeeRule): RuleDraft {
  return {
    match: rule.match,
    matchType: rule.matchType,
    renameTo: rule.renameTo,
    categoryId: rule.categoryId ?? "none",
    memo: rule.memo ?? "",
    enabled: rule.enabled,
    applyToExisting: false,
  };
}

export function BudgetPayeeRulesContent() {
  const {
    budget,
    savePayeeRule,
    removePayeeRule,
    movePayeeRule,
    togglePayeeRule,
    mergeBudgetPayees,
  } = useBudget();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const appliedPrefill = useRef<string | null>(null);

  const rules = useMemo(
    () => orderedPayeeRules(budget.payeeRules ?? []),
    [budget.payeeRules],
  );
  const payees = useMemo(
    () => derivePayees(budget.transactions),
    [budget.transactions],
  );
  const categories = userAssignableCategories(budget.categories);
  const groups = [...budget.categoryGroups].sort((a, b) => a.sortOrder - b.sortOrder);
  const categoryItems = useMemo(() => {
    const items: Record<string, string> = { none: "No category" };
    const assignable = userAssignableCategories(budget.categories);
    const orderedGroups = [...budget.categoryGroups].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const group of orderedGroups) {
      for (const category of assignable
        .filter((entry) => entry.groupId === group.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)) {
        items[category.id] = `${group.name} · ${category.name}`;
      }
    }
    return items;
  }, [budget.categories, budget.categoryGroups]);
  const categoryName = useMemo(() => {
    const names = new Map(budget.categories.map((category) => [category.id, category.name]));
    return (id: string | null | undefined) => (id ? names.get(id) ?? "Missing category" : "No category");
  }, [budget.categories]);

  const prefillMatch = searchParams.get("match");
  useEffect(() => {
    if (!prefillMatch) {
      appliedPrefill.current = null;
      return;
    }
    if (appliedPrefill.current === prefillMatch) return;
    appliedPrefill.current = prefillMatch;
    const matchType = searchParams.get("matchType");
    setEditing("new");
    setDraft({
      match: prefillMatch,
      matchType: isPayeeRuleMatchType(matchType) ? matchType : "contains",
      renameTo: searchParams.get("renameTo") || prefillMatch,
      categoryId: searchParams.get("categoryId") || "none",
      memo: "",
      enabled: true,
      applyToExisting: false,
    });
  }, [prefillMatch, searchParams]);

  const matchCount = useMemo(() => {
    if (!draft.match.trim()) return 0;
    return countPayeeRuleMatches(budget.transactions, {
      match: draft.match,
      matchType: draft.matchType,
      enabled: true,
    });
  }, [budget.transactions, draft.match, draft.matchType]);

  function openNew() {
    setEditing("new");
    setDraft(emptyDraft());
  }

  function openEdit(rule: PayeeRule) {
    setEditing(rule.id);
    setDraft(draftFromRule(rule));
  }

  function closeForm() {
    setEditing(null);
    setDraft(emptyDraft());
    if (searchParams.get("match")) router.replace(pathname);
  }

  function saveForm() {
    if (!draft.match.trim() || !draft.renameTo.trim()) return;
    savePayeeRule(
      {
        match: draft.match,
        matchType: draft.matchType,
        renameTo: draft.renameTo,
        categoryId: draft.categoryId === "none" ? null : draft.categoryId,
        memo: draft.memo,
        enabled: draft.enabled,
      },
      {
        id: editing && editing !== "new" ? editing : undefined,
        applyToExisting: editing === "new" && draft.applyToExisting,
      },
    );
    closeForm();
  }

  const formTitle = editing === "new" ? "New rule" : "Edit rule";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <BudgetPageHeader
        title="Payee rules"
        description="Clean up messy bank names and categorize them when they come in. The first matching rule wins."
        action={
          <Button type="button" onClick={openNew}>
            <Plus className="size-4" />
            New rule
          </Button>
        }
      />

      {editing ? (
        <BudgetPanel className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold">{formTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Matching ignores case and extra spaces. Rename can be a payee you already use or a new one.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payee-rule-match">When the payee</Label>
              <div className="flex gap-2">
                <Select
                  items={MATCH_TYPE_LABEL}
                  value={draft.matchType}
                  onValueChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      matchType: isPayeeRuleMatchType(value) ? value : "contains",
                    }))
                  }
                >
                  <SelectTrigger className="w-[9.5rem] shrink-0" aria-label="Match type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MATCH_TYPE_LABEL) as PayeeRuleMatchType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {MATCH_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="payee-rule-match"
                  value={draft.match}
                  placeholder="AMZN MKTP"
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, match: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payee-rule-rename">Rename to</Label>
              <Input
                id="payee-rule-rename"
                value={draft.renameTo}
                list="payee-rule-payees"
                placeholder="Amazon"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, renameTo: event.target.value }))
                }
              />
              <datalist id="payee-rule-payees">
                {payees.map((payee) => (
                  <option key={payee.name} value={payee.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payee-rule-category">Category</Label>
              <Select
                items={categoryItems}
                value={draft.categoryId}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, categoryId: value ?? "none" }))
                }
              >
                <SelectTrigger id="payee-rule-category">
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {groups.flatMap((group) =>
                    categories
                      .filter((category) => category.groupId === group.id)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {group.name} · {category.name}
                        </SelectItem>
                      )),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payee-rule-memo">Memo</Label>
              <Input
                id="payee-rule-memo"
                value={draft.memo}
                placeholder="Optional"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, memo: event.target.value }))
                }
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {draft.match.trim()
              ? `Matches ${matchCount} existing transaction${matchCount === 1 ? "" : "s"}.`
              : "Type a match to see how many transactions it would catch."}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="budget-check"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              Enabled
            </label>
            {editing === "new" ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="budget-check mt-0.5"
                  checked={draft.applyToExisting}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      applyToExisting: event.target.checked,
                    }))
                  }
                />
                <span>
                  Apply to existing uncategorized transactions
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Renames matching payees. Categorizes only rows that are still empty. Off by default.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={saveForm}
              disabled={!draft.match.trim() || !draft.renameTo.trim()}
            >
              Save rule
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </BudgetPanel>
      ) : null}

      <BudgetPanel>
        {rules.length === 0 ? (
          <BudgetEmptyState
            title="No payee rules yet"
            description="A rule turns AMZN MKTP CA*2K4X91 into Amazon and can file it under a category the next time it imports."
            actions={
              <Button type="button" onClick={openNew}>
                <Plus className="size-4" />
                New rule
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {rules.map((rule, index) => {
              const count = countPayeeRuleMatches(budget.transactions, rule);
              return (
                <li
                  key={rule.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      className="budget-check mt-1"
                      checked={rule.enabled}
                      aria-label={rule.enabled ? `Disable ${rule.match}` : `Enable ${rule.match}`}
                      onChange={(event) => togglePayeeRule(rule.id, event.target.checked)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <span className="text-muted-foreground">
                          {MATCH_TYPE_LABEL[rule.matchType]}{" "}
                        </span>
                        {rule.match}
                        <span className="text-muted-foreground"> → </span>
                        {rule.renameTo}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {categoryName(rule.categoryId)}
                        {rule.memo ? ` · ${rule.memo}` : ""}
                        {` · ${count} match${count === 1 ? "" : "es"}`}
                        {rule.enabled ? "" : " · Off"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${rule.match} earlier`}
                      disabled={index === 0}
                      onClick={() => movePayeeRule(rule.id, "up")}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${rule.match} later`}
                      disabled={index === rules.length - 1}
                      onClick={() => movePayeeRule(rule.id, "down")}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${rule.match}`}
                      onClick={() => openEdit(rule)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${rule.match}`}
                      onClick={() => removePayeeRule(rule.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </BudgetPanel>

      <BudgetPanel className="space-y-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold">Merge payees</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Move every transaction from one payee onto another and keep a rename rule for next time.
          </p>
        </div>
        {payees.length < 2 ? (
          <p className="text-sm text-muted-foreground">
            Two payees need to be on the register before you can merge them.
          </p>
        ) : (
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="merge-from">From</Label>
              <Select value={mergeFrom} onValueChange={(value) => setMergeFrom(value ?? "")}>
                <SelectTrigger id="merge-from">
                  <SelectValue placeholder="Payee to merge away" />
                </SelectTrigger>
                <SelectContent>
                  {payees.map((payee) => (
                    <SelectItem key={payee.name} value={payee.name}>
                      {payee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="merge-to">Into</Label>
              <Select value={mergeTo} onValueChange={(value) => setMergeTo(value ?? "")}>
                <SelectTrigger id="merge-to">
                  <SelectValue placeholder="Payee to keep" />
                </SelectTrigger>
                <SelectContent>
                  {payees
                    .filter((payee) => payee.name !== mergeFrom)
                    .map((payee) => (
                      <SelectItem key={payee.name} value={payee.name}>
                        {payee.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!mergeFrom || !mergeTo || mergeFrom === mergeTo}
              onClick={() => {
                mergeBudgetPayees(mergeFrom, mergeTo);
                setMergeFrom("");
                setMergeTo("");
              }}
            >
              Merge
            </Button>
          </div>
        )}
      </BudgetPanel>
    </div>
  );
}
