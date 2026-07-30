"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Crown,
  Loader2,
  Lock,
  Pencil,
  PieChart,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { PremiumUpgradeCallout } from "@/components/plans/premium-upgrade-callout";
import { PremiumUpgradeDialog } from "@/components/plans/premium-upgrade-dialog";
import { DeletePortfolioDialog } from "@/components/portfolio/delete-portfolio-dialog";
import { PortfolioNameDialog } from "@/components/portfolio/portfolio-name-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { usePremiumUpgradePrompt } from "@/hooks/use-premium-upgrade-prompt";
import { useUserPlan } from "@/hooks/use-user-preferences";
import {
  canCreateLimitedResource,
  isPlanLimitError,
} from "@/lib/plans/access";
import { canOpenPortfolioOnPlan } from "@/lib/plans/free-access";
import type { UserPortfolio } from "@/types/portfolio";

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function PortfolioPlansListContent() {
  const router = useRouter();
  const {
    summaries,
    portfolios,
    createPortfolio,
    renamePortfolio,
    setPrimaryPortfolio,
    deletePortfolio,
    setActivePortfolioId,
    isLoaded,
    syncError,
  } = usePortfolioPlans();
  const { plan: userPlan, prefsLoadSucceeded, isLoaded: isPlanLoaded } =
    useUserPlan();
  const upgrade = usePremiumUpgradePrompt();

  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<UserPortfolio | null>(null);
  const [deleting, setDeleting] = useState<UserPortfolio | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const isPlanReady = isPlanLoaded;
  const effectivePlan = prefsLoadSucceeded ? userPlan : "free";
  const atFreeLimit =
    isPlanReady &&
    !canCreateLimitedResource(effectivePlan, "portfolio", portfolios.length);
  const freeHasExtras =
    prefsLoadSucceeded &&
    userPlan === "free" &&
    portfolios.length > 1;
  const canDelete = portfolios.length > 1;

  async function handleCreate(name: string) {
    setIsCreating(true);
    try {
      const portfolio = await createPortfolio(name);
      setCreateOpen(false);
      setActivePortfolioId(portfolio.id);
      router.push(`/portfolio/${portfolio.id}`);
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
      upgrade.promptLimit("portfolio");
      return;
    }
    setCreateOpen(true);
  }

  function openPortfolio(portfolio: UserPortfolio) {
    if (!canOpenPortfolioOnPlan(effectivePlan, portfolio)) {
      upgrade.promptOpen("portfolio");
      return;
    }
    setActivePortfolioId(portfolio.id);
    router.push(`/portfolio/${portfolio.id}`);
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading portfolios…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Portfolios</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage your investment portfolios. Mark one as Primary — that is the
            default used on Invest, Analytics, and AI. Free can open only the
            Primary portfolio; extras stay listed for cleanup.
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
          Create New Portfolio
        </Button>
      </div>

      {atFreeLimit && <PremiumUpgradeCallout resource="portfolio" />}

      {freeHasExtras && (
        <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You currently have {portfolios.length} portfolios. Extra portfolios
          were kept so no data was lost — delete ones you do not need, or upgrade
          to Premium for unlimited portfolios.
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
              <PieChart className="size-6" />
            </div>
            <CardTitle>No portfolios yet</CardTitle>
            <CardDescription>
              Start with zero portfolios, then create your first one. After that
              you must keep at least one portfolio (the last one cannot be
              deleted).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              onClick={openCreate}
              className="gap-2"
              disabled={isCreating || !isPlanReady}
            >
              <Plus className="size-4" />
              Create your first portfolio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const portfolio = portfolios.find((item) => item.id === summary.id);
            const canOpen =
              portfolio != null &&
              canOpenPortfolioOnPlan(effectivePlan, portfolio);

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
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!canOpen && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                          <Lock className="size-3" />
                          Premium
                        </span>
                      )}
                      {summary.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
                          <Star className="size-3 fill-primary" />
                          Primary
                        </span>
                      )}
                    </div>
                  </div>
                  <CardDescription>
                    {summary.holdingCount} holding
                    {summary.holdingCount === 1 ? "" : "s"}
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
                      onClick={() => portfolio && openPortfolio(portfolio)}
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
                      onClick={() => portfolio && setRenaming(portfolio)}
                    >
                      Rename
                    </Button>
                    {!summary.isPrimary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setPrimaryPortfolio(summary.id)}
                      >
                        <Crown className="size-3.5" />
                        Primary
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={!canDelete}
                      title={
                        canDelete
                          ? "Delete portfolio"
                          : "You must keep at least one portfolio"
                      }
                      onClick={() => portfolio && setDeleting(portfolio)}
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

      <PortfolioNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create portfolio"
        description="Give your portfolio a name so you can find it easily."
        confirmLabel="Create portfolio"
        onConfirm={handleCreate}
        isSubmitting={isCreating}
      />

      <PortfolioNameDialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename portfolio"
        description="Update the display name for this portfolio."
        confirmLabel="Save name"
        defaultName={renaming?.name ?? ""}
        onConfirm={async (name) => {
          if (!renaming) return;
          renamePortfolio(renaming.id, name);
          setRenaming(null);
        }}
      />

      <DeletePortfolioDialog
        portfolio={deleting}
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        canDelete={canDelete}
        onConfirm={async (id) => {
          await deletePortfolio(id);
          setDeleting(null);
        }}
      />

      <PremiumUpgradeDialog {...upgrade.dialogProps} />
    </div>
  );
}
