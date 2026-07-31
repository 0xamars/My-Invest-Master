"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Crown,
  Eye,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { PremiumUpgradeCallout } from "@/components/plans/premium-upgrade-callout";
import { PremiumUpgradeDialog } from "@/components/plans/premium-upgrade-dialog";
import { DeleteWatchlistDialog } from "@/components/watchlist/delete-watchlist-dialog";
import { WatchlistNameDialog } from "@/components/watchlist/watchlist-name-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWatchlistPlans } from "@/contexts/watchlist-plans-context";
import { usePremiumUpgradePrompt } from "@/hooks/use-premium-upgrade-prompt";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  canCreateLimitedResource,
  isPlanLimitError,
} from "@/lib/plans/access";
import { canOpenWatchlistOnPlan } from "@/lib/plans/free-access";
import type { UserWatchlist } from "@/types/watchlist";

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function WatchlistPlansListContent() {
  const router = useRouter();
  const {
    summaries,
    lists,
    createWatchlistAndSave,
    renameWatchlist,
    deleteWatchlist,
    isLoaded,
    syncError,
    isPlanReady,
  } = useWatchlistPlans();
  const { plan: userPlan, prefsLoadSucceeded, isLoaded: isPlanLoaded } =
    useUserPlan();
  const upgrade = usePremiumUpgradePrompt();

  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<UserWatchlist | null>(null);
  const [deleting, setDeleting] = useState<UserWatchlist | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const effectivePlan = prefsLoadSucceeded ? userPlan : "free";
  const atFreeLimit =
    isPlanReady &&
    !canCreateLimitedResource(effectivePlan, "watchlist", lists.length);
  const freeHasExtras =
    prefsLoadSucceeded && userPlan === "free" && lists.length > 1;

  async function handleCreate(name: string) {
    setIsCreating(true);
    try {
      const list = await createWatchlistAndSave(name);
      setCreateOpen(false);
      router.push(`/watchlist/${list.id}`);
    } catch (error) {
      if (isPlanLimitError(error)) {
        setCreateOpen(false);
        upgrade.promptLimit(error.resource);
      } else {
        throw error;
      }
    } finally {
      setIsCreating(false);
    }
  }

  function openCreate() {
    if (!isPlanReady) return;
    if (atFreeLimit) {
      upgrade.promptLimit("watchlist");
      return;
    }
    setCreateOpen(true);
  }

  function openWatchlist(list: UserWatchlist) {
    if (!canOpenWatchlistOnPlan(effectivePlan, lists, list.id)) {
      upgrade.promptOpen("watchlist");
      return;
    }
    router.push(`/watchlist/${list.id}`);
  }

  if (!isLoaded || !isPlanLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading watchlists…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Stage tickers you are researching — not holdings you own. Free
            includes 1 watchlist; Premium unlocks unlimited lists.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="gap-2"
          disabled={isCreating || !isPlanReady}
        >
          {isCreating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : atFreeLimit ? (
            <Crown className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          Create Watchlist
        </Button>
      </div>

      {atFreeLimit && <PremiumUpgradeCallout resource="watchlist" />}

      {freeHasExtras && (
        <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You currently have {lists.length} watchlists. Extra lists stay listed
          so you can delete them, or upgrade to Premium for unlimited
          watchlists.
        </div>
      )}

      {syncError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      {summaries.length === 0 ? (
        <Card className="surface-card border-dashed shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Eye className="size-6" />
            </div>
            <CardTitle>No watchlists yet</CardTitle>
            <CardDescription>
              Create a watchlist to track stocks and crypto you are researching
              before they become portfolio holdings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              onClick={openCreate}
              className="gap-2"
              disabled={isCreating || !isPlanReady}
            >
              <Plus className="size-4" />
              Create your first watchlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const list = lists.find((item) => item.id === summary.id);
            const canOpen =
              list != null &&
              canOpenWatchlistOnPlan(effectivePlan, lists, summary.id);

            return (
              <Card
                key={summary.id}
                className="surface-card gap-0 py-0 shadow-none transition-colors hover:border-border"
              >
                <CardHeader className="border-b border-border/60 px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="truncate text-base font-semibold">
                      {summary.name}
                    </CardTitle>
                    {!canOpen && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                        <Lock className="size-3" />
                        Premium
                      </span>
                    )}
                  </div>
                  <CardDescription>
                    {summary.itemCount} ticker
                    {summary.itemCount === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-5 py-4">
                  <p className="text-xs text-muted-foreground">
                    Updated {formatUpdatedAt(summary.updatedAt)}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => list && openWatchlist(list)}
                    >
                      {canOpen ? (
                        <Pencil className="size-3.5" />
                      ) : (
                        <Lock className="size-3.5" />
                      )}
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => list && setRenaming(list)}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => list && setDeleting(list)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <WatchlistNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create watchlist"
        description="Name this research list so you can find it easily."
        confirmLabel="Create watchlist"
        onConfirm={handleCreate}
        isSubmitting={isCreating}
      />

      <WatchlistNameDialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename watchlist"
        description="Update the display name for this watchlist."
        confirmLabel="Save name"
        defaultName={renaming?.name ?? ""}
        onConfirm={async (name) => {
          if (!renaming) return;
          renameWatchlist(renaming.id, name);
          setRenaming(null);
        }}
      />

      <DeleteWatchlistDialog
        watchlist={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={async (id) => {
          await deleteWatchlist(id);
          setDeleting(null);
        }}
      />

      <PremiumUpgradeDialog {...upgrade.dialogProps} />
    </div>
  );
}
