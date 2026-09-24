"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { BudgetPanel } from "@/components/budget/budget-ui";
import { useBudget } from "@/contexts/budget-context";
import { useBudgetPlans } from "@/contexts/budget-plans-context";
import {
  formatPlaidItemSyncLine,
  plaidItemNeedsUserReconnect,
} from "@/lib/plaid/item-status";
import { commitPlaidCursorAfterSave } from "@/lib/plaid/cursor";
import type { PlaidItemSummary, PlaidStatusResponse, PlaidSyncPayload } from "@/lib/plaid/types";

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

export function BudgetBankLink({
  primary = false,
}: {
  primary?: boolean;
}) {
  const { planId, importFromPlaid, unlinkPlaidItem } = useBudget();
  const { flushPlanSave } = useBudgetPlans();
  const [status, setStatus] = useState<PlaidStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [updateItemId, setUpdateItemId] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/plaid/status?planId=${encodeURIComponent(planId)}`);
      if (!response.ok) {
        setStatus({
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
    async (payload: PlaidSyncPayload) => {
      importFromPlaid(payload);
      await commitPlaidCursorAfterSave({
        save: () => flushPlanSave(planId),
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
    },
    [flushPlanSave, importFromPlaid, planId],
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
        await applyPayload(data.payload);
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
      await applyPayload(data.payload);
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
      await applyPayload(data.payload);
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
      unlinkPlaidItem(item.itemId);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setBusy(false);
    }
  };

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
          <p className="text-sm font-semibold">Connect bank</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {disabledReason ??
              "Pull transactions into the inbox, then assign envelopes. You can also import a CSV, OFX, or QFX file from the register."}
          </p>
        </div>
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
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          Checking bank connections…
        </p>
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
                  {needsReconnect ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !configured}
                      onClick={() => void startLink(item.itemId)}
                    >
                      <Plug className="size-3.5" />
                      Reconnect
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void syncItem(item)}
                    >
                      <RefreshCw className="size-3.5" />
                      Sync
                    </Button>
                  )}
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
