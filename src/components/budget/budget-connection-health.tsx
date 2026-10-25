"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  budgetPageListsBankConnections,
  formatPlaidItemSyncLine,
  plaidItemNeedsUserReconnect,
} from "@/lib/plaid/item-status";
import type { PlaidItemSummary, PlaidStatusResponse } from "@/lib/plaid/types";

/**
 * Accounts and the register list each connection.
 * Overview, reports, and payee rules otherwise stay quiet when a bank is stale.
 */
export function BudgetConnectionHealth({ planId }: { planId: string }) {
  const pathname = usePathname();
  const listedOnPage = budgetPageListsBankConnections(pathname);
  const [items, setItems] = useState<PlaidItemSummary[] | null>(null);

  useEffect(() => {
    if (listedOnPage) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/plaid/status?planId=${encodeURIComponent(planId)}`,
        );
        if (!response.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const data = (await response.json()) as PlaidStatusResponse;
        if (!cancelled) setItems(data.items ?? []);
      } catch {
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listedOnPage, planId]);

  if (listedOnPage || !items || items.length === 0) return null;

  return (
    <ul className="mb-4 flex flex-col gap-2" data-budget-connection-health="1">
      {items.map((item) => {
        const needsAction = plaidItemNeedsUserReconnect(item.status);
        return (
          <li
            key={item.itemId}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 px-4 py-3 text-sm"
            role={needsAction ? "status" : undefined}
          >
            <p className="min-w-0 flex-1">
              <span className="font-medium">{item.institutionName ?? "Linked bank"}</span>
              <span
                className={
                  needsAction
                    ? "text-[var(--brand-orange)]"
                    : "text-muted-foreground"
                }
              >
                {" · "}
                {formatPlaidItemSyncLine(item)}
              </span>
            </p>
            {needsAction ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                render={
                  <Link href={`/budget/plans/${planId}/transactions?import=1`} />
                }
              >
                <Upload className="size-3.5" />
                Import a file instead
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
