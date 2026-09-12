"use client";

import { useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, RefreshCw, Unplug } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { BudgetPanel } from "@/components/budget/budget-ui";
import { useBudget } from "@/contexts/budget-context";
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
      if (!publicToken) return;
      onSuccess(publicToken, {
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
  const [status, setStatus] = useState<PlaidStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

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
    (payload: PlaidSyncPayload) => {
      importFromPlaid(payload);
    },
    [importFromPlaid],
  );

  const startLink = async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = (await response.json()) as { linkToken?: string; error?: string };
      if (!response.ok || !data.linkToken) {
        throw new Error(data.error ?? "Could not start bank link");
      }
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
    setLinkToken(null);
    setBusy(true);
    setError(null);
    try {
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
      applyPayload(data.payload);
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
      applyPayload(data.payload);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync bank");
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
          onExit={() => setLinkToken(null)}
        />
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Connect bank</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {disabledReason ??
              "Pull transactions into the inbox, then assign envelopes. File import stays as a fallback."}
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

      {status?.items.length ? (
        <ul className="mt-4 divide-y divide-border/50">
          {status.items.map((item) => (
            <li
              key={item.itemId}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.institutionName ?? "Linked bank"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.lastSyncedAt
                    ? `Last sync ${new Date(item.lastSyncedAt).toLocaleString()}`
                    : "Connected · sync to pull transactions"}
                </p>
              </div>
              <div className="flex gap-2">
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
          ))}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[var(--brand-orange)]">{error}</p>
      ) : null}
    </BudgetPanel>
  );
}
