"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { BudgetPanel } from "@/components/budget/budget-ui";
import { useBudget } from "@/contexts/budget-context";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import {
  formatLinkedAccountName,
  mapPlaidAccountType,
  plaidAccountsNeedingMap,
  type PlaidAccountChoice,
} from "@/lib/budget/plaid";
import { ACCOUNT_TYPE_LABELS } from "@/lib/budget/accounts";
import {
  formatPlaidItemSyncLine,
  plaidItemNeedsUserReconnect,
} from "@/lib/plaid/item-status";
import {
  commitPlaidCursorAfterSave,
  plaidSyncNeedsDurableSave,
} from "@/lib/plaid/cursor";
import type { PlaidItemSummary, PlaidStatusResponse, PlaidSyncPayload } from "@/lib/plaid/types";
import type { BudgetAccount, BudgetPlan, BudgetTransaction } from "@/types/budget";

function PlaidOpen({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } }) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken, metadata) => {
      onSuccess(publicToken ?? "", {
        institution: metadata.institution
          ? {
              institution_id: metadata.institution.institution_id ?? undefined,
              name: metadata.institution.name ?? undefined,
            }
          : undefined,
      });
    },
    onExit,
  });

  useEffect(() => {
    if (ready) open();
  }, [open, ready]);

  return null;
}

function suggestBudgetAccountId(
  bankType: string,
  bankSubtype: string | null,
  accounts: BudgetAccount[],
  transactions: BudgetTransaction[],
  taken: Set<string>,
): string {
  const type = mapPlaidAccountType(bankType, bankSubtype);
  const unused = accounts.filter(
    (account) =>
      account.type === type &&
      !account.plaidAccountId &&
      !taken.has(account.id) &&
      !transactions.some((tx) => tx.accountId === account.id),
  );
  return unused.length === 1 ? unused[0]!.id : "";
}

function AccountMapping({
  payload,
  accounts,
  transactions,
  busy,
  onCancel,
  onSave,
}: {
  payload: PlaidSyncPayload;
  accounts: BudgetAccount[];
  transactions: BudgetTransaction[];
  busy: boolean;
  onCancel: () => void;
  onSave: (choices: PlaidAccountChoice[]) => void;
}) {
  const unmapped = plaidAccountsNeedingMap({ accounts }, payload.accounts);
  const [choices, setChoices] = useState<Record<string, string>>(() => {
    const taken = new Set<string>();
    const next: Record<string, string> = {};
    for (const account of unmapped) {
      const suggested = suggestBudgetAccountId(
        account.type,
        account.subtype,
        accounts,
        transactions,
        taken,
      );
      next[account.plaidAccountId] = suggested;
      if (suggested) taken.add(suggested);
    }
    return next;
  });
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const selected = Object.values(choices).filter((id) => id);
    if (new Set(selected).size !== selected.length) {
      setError("Each bank account needs its own budget account.");
      return;
    }
    setError(null);
    onSave(
      unmapped.map((account) => ({
        plaidAccountId: account.plaidAccountId,
        budgetAccountId: choices[account.plaidAccountId] || null,
      })),
    );
  };

  return (
    <div className="mt-4 border-t border-border/50 pt-4" data-bank-account-map="1">
      <p className="text-sm font-semibold">Choose budget accounts</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick the budget account each bank account should feed, or create a new one.
        Use the account you already import files into so those rows are not added twice.
      </p>
      <ul className="mt-3 flex flex-col gap-3">
        {unmapped.map((account) => (
          <li key={account.plaidAccountId} className="flex flex-col gap-1">
            <label className="text-sm font-medium" htmlFor={`bank-map-${account.plaidAccountId}`}>
              {formatLinkedAccountName(account.name, account.mask)}
              <span className="ml-2 font-normal text-muted-foreground">
                {ACCOUNT_TYPE_LABELS[mapPlaidAccountType(account.type, account.subtype)]}
              </span>
            </label>
            <select
              id={`bank-map-${account.plaidAccountId}`}
              className="h-10 w-full rounded-[var(--radius)] border border-border bg-muted px-3 text-sm"
              value={choices[account.plaidAccountId] ?? ""}
              disabled={busy}
              onChange={(event) => {
                setChoices((current) => ({
                  ...current,
                  [account.plaidAccountId]: event.target.value,
                }));
              }}
            >
              <option value="">Create a new account</option>
              {accounts
                .filter((budgetAccount) => !budgetAccount.plaidAccountId)
                .map((budgetAccount) => (
                  <option key={budgetAccount.id} value={budgetAccount.id}>
                    {budgetAccount.name}
                  </option>
                ))}
            </select>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="mt-3 text-sm text-[var(--brand-orange)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={save}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Save and sync
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Not now
        </Button>
      </div>
    </div>
  );
}

export function BudgetBankLink({
  primary = false,
}: {
  primary?: boolean;
}) {
  const { planId, budget, importFromPlaid, unlinkPlaidItem } = useBudget();
  const { enqueuePlanSave } = useBudgetPlans();
  const [status, setStatus] = useState<PlaidStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [updateItemId, setUpdateItemId] = useState<string | null>(null);
  const [pending, setPending] = useState<PlaidSyncPayload | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/plaid/status?planId=${encodeURIComponent(planId)}`);
      if (!response.ok) {
        setStatus({
          enabled: true,
          configured: false,
          storageReady: false,
          env: "sandbox",
          webhookUrl: null,
          items: [],
        });
        return;
      }
      setStatus((await response.json()) as PlaidStatusResponse);
    } catch {
      setStatus({
        enabled: true,
        configured: false,
        storageReady: false,
        env: "sandbox",
        webhookUrl: null,
        items: [],
      });
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const applyPayload = useCallback(
    async (payload: PlaidSyncPayload, choices?: PlaidAccountChoice[]) => {
      if (choices) {
        payload = { ...payload, accountChoices: choices };
      }
      const plan = importFromPlaid(payload);
      await commitPlaidCursorAfterSave({
        needsSave: plaidSyncNeedsDurableSave(payload),
        plan,
        save: (next) => enqueuePlanSave(next),
        commit: async () => {
          const nextCursor = payload.cursor?.next?.trim() ?? "";
          if (!nextCursor) return;
          const response = await fetch("/api/plaid/sync/commit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId: payload.itemId,
              previousCursor: payload.cursor?.previous ?? null,
              nextCursor,
            }),
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(
              data.error ??
                "Saved transactions, but the bank bookmark did not update. Sync again.",
            );
          }
        },
      });
      if (!choices || !plan) return;
      const mappings = plan.accounts
        .filter(
          (account) =>
            account.plaidItemId === payload.itemId && account.plaidAccountId,
        )
        .map((account) => ({
          plaidAccountId: account.plaidAccountId ?? "",
          budgetAccountId: account.id,
        }))
        .filter((row) => row.plaidAccountId);
      if (mappings.length === 0) return;
      const response = await fetch("/api/plaid/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: payload.itemId, mappings }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Saved transactions, but the account link was not stored.");
      }
    },
    [enqueuePlanSave, importFromPlaid],
  );

  const beginImport = useCallback(
    async (payload: PlaidSyncPayload) => {
      const current: BudgetPlan | undefined = budget;
      if (
        current &&
        plaidAccountsNeedingMap(current, payload.accounts).length > 0
      ) {
        setPending(payload);
        return;
      }
      await applyPayload(payload);
      setPending(null);
    },
    [applyPayload, budget],
  );

  const startLink = async (itemId?: string) => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      const data = (await response.json()) as { linkToken?: string; error?: string };
      if (!response.ok || !data.linkToken) {
        throw new Error(data.error ?? "Could not start bank link");
      }
      setUpdateItemId(itemId ?? null);
      setLinkToken(data.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start bank link");
    } finally {
      setBusy(false);
    }
  };

  const handleSuccess = async (
    publicToken: string,
    metadata: { institution?: { institution_id?: string; name?: string } },
  ) => {
    const existingItemId = updateItemId;
    setLinkToken(null);
    setUpdateItemId(null);
    setBusy(true);
    setError(null);
    try {
      if (existingItemId) {
        const response = await fetch("/api/plaid/reconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: existingItemId }),
        });
        const data = (await response.json()) as {
          payload?: PlaidSyncPayload;
          error?: string;
        };
        if (!response.ok || !data.payload) {
          throw new Error(data.error ?? "Could not reconnect bank");
        }
        await beginImport(data.payload);
        await refreshStatus();
        return;
      }

      const response = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicToken,
          planId,
          institution: metadata.institution,
        }),
      });
      const data = (await response.json()) as {
        payload?: PlaidSyncPayload;
        error?: string;
      };
      if (!response.ok || !data.payload) {
        throw new Error(data.error ?? "Could not connect bank");
      }
      await beginImport(data.payload);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect bank");
    } finally {
      setBusy(false);
    }
  };

  const syncItem = async (item: PlaidItemSummary) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId }),
      });
      const data = (await response.json()) as {
        payload?: PlaidSyncPayload;
        error?: string;
      };
      if (!response.ok || !data.payload) {
        throw new Error(data.error ?? "Could not sync bank");
      }
      await beginImport(data.payload);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync bank");
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  const disconnectItem = async (item: PlaidItemSummary) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/plaid/item", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not disconnect");
      }
      if (pending?.itemId === item.itemId) setPending(null);
      unlinkPlaidItem(item.itemId);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  };

  const saveMapping = async (choices: PlaidAccountChoice[]) => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await applyPayload(pending, choices);
      setPending(null);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync bank");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !status) return null;
  const canLink = status.enabled === true;
  if (!canLink && status.items.length === 0) return null;

  const configured = status?.configured === true && status.storageReady === true;
  const disabledReason = !status
    ? null
    : !status.configured
      ? "Bank linking is not set up on this server."
      : !status.storageReady
        ? "Bank linking needs a server database key."
        : null;

  return (
    <BudgetPanel className="px-4 py-4 sm:px-5" data-budget-bank-link="1">
      {linkToken ? (
        <PlaidOpen
          token={linkToken}
          onSuccess={handleSuccess}
          onExit={() => {
            setLinkToken(null);
            setUpdateItemId(null);
          }}
        />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {canLink ? "Connect bank" : "Linked bank"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canLink
              ? (disabledReason ??
                "Pull transactions into the inbox, then assign envelopes. You can also import a CSV, OFX, or QFX file from the register.")
              : "Bank linking is off for this account. You can still disconnect a bank that is already linked."}
          </p>
        </div>
        {canLink ? (
          <Button
            type="button"
            variant={primary ? "default" : "outline"}
            disabled={!configured || busy || loading}
            onClick={() => void startLink()}
          >
            {busy || loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Landmark className="size-4" />
            )}
            Connect bank
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Checking bank connections…
        </p>
      ) : null}

      {pending && budget ? (
        <AccountMapping
          payload={pending}
          accounts={budget.accounts}
          transactions={budget.transactions}
          busy={busy}
          onCancel={() => setPending(null)}
          onSave={(choices) => void saveMapping(choices)}
        />
      ) : null}

      {status?.items.length ? (
        <ul className="mt-4 divide-y divide-border/50">
          {status.items.map((item) => {
            const needsReconnect = plaidItemNeedsUserReconnect(item.status);
            return (
              <li
                key={item.itemId}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
                data-plaid-item-status={item.status}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.institutionName ?? "Linked bank"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPlaidItemSyncLine(item)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canLink && needsReconnect ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !configured}
                      onClick={() => void startLink(item.itemId)}
                    >
                      <Plug className="size-3.5" />
                      Reconnect
                    </Button>
                  ) : null}
                  {canLink && !needsReconnect ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void syncItem(item)}
                    >
                      <RefreshCw className="size-3.5" />
                      Sync now
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void disconnectItem(item)}
                  >
                    <Unplug className="size-3.5" />
                    Disconnect
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[var(--brand-orange)]" role="alert">
          {error}
        </p>
      ) : null}
    </BudgetPanel>
  );
}
