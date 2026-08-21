"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  Plus,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { DeletePortfolioDialog } from "@/components/portfolio/delete-portfolio-dialog";
import { PortfolioNameDialog } from "@/components/portfolio/portfolio-name-dialog";
import {
  BudgetEmptyState,
  BudgetPageHeader,
  BudgetPanel,
} from "@/components/budget/budget-ui";
import { Button } from "@/components/ui/button";
import { PillarBackLink } from "@/components/layout/pillar-back-link";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { INVEST_PATH, investPortfolioPath } from "@/lib/chrome/nav";
import { cn } from "@/lib/utils";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<UserPortfolio | null>(null);
  const [deleting, setDeleting] = useState<UserPortfolio | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const canDelete = portfolios.length > 1;

  async function handleCreate(name: string) {
    setIsCreating(true);
    try {
      const portfolio = await createPortfolio(name);
      setCreateOpen(false);
      setActivePortfolioId(portfolio.id);
      router.push(investPortfolioPath(portfolio.id));
    } finally {
      setIsCreating(false);
    }
  }

  function openCreate() {
    setCreateOpen(true);
  }

  function openPortfolio(portfolio: UserPortfolio) {
    setActivePortfolioId(portfolio.id);
    router.push(investPortfolioPath(portfolio.id));
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
    <div className="flex flex-1 flex-col gap-6">
      <PillarBackLink href={INVEST_PATH} label="Back to Invest" />
      <BudgetPageHeader
        title="Portfolios"
        description="Each book is a plan. Primary is the checkup default on Invest. Open a book to manage holdings, mix, and leverage."
        action={
          <Button onClick={openCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            New book
          </Button>
        }
      />

      {syncError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {syncError}
        </div>
      )}

      {summaries.length === 0 ? (
        <BudgetPanel>
          <BudgetEmptyState
            icon={<TrendingUp className="size-5" />}
            title="No books yet"
            description="Create a portfolio, then add holdings. You must keep at least one book after that."
            actions={
              <Button onClick={openCreate} disabled={isCreating}>
                <Plus className="size-4" />
                Create your first book
              </Button>
            }
          />
        </BudgetPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const portfolio = portfolios.find((item) => item.id === summary.id);

            return (
              <div
                key={summary.id}
                className={cn(
                  "budget-panel group relative transition-colors hover:border-[var(--brand-green)]/35",
                  summary.isPrimary && "border-[var(--brand-green)]/40",
                )}
              >
                <div
                  className={cn(
                    "absolute inset-y-3 left-0 w-1 rounded-full",
                    summary.isPrimary
                      ? "bg-[var(--brand-green)]"
                      : "bg-[var(--brand-green)]/40 opacity-80",
                  )}
                />
                <div className="px-5 py-4 pl-6">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => portfolio && openPortfolio(portfolio)}
                      className="min-w-0 truncate text-left text-sm font-semibold tracking-tight hover:text-[var(--brand-green)]"
                    >
                      {summary.name}
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {summary.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-green)]/12 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--brand-green)]">
                          <Star className="size-3 fill-current" />
                          Primary
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => portfolio && openPortfolio(portfolio)}
                    className="mt-4 block w-full text-left"
                  >
                    <p className="budget-metric-label">Holdings</p>
                    <p className="mt-1 text-[1.65rem] font-semibold tracking-tight tabular-nums">
                      {summary.holdingCount}
                    </p>
                  </button>
                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Updated {formatUpdatedAt(summary.updatedAt)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => portfolio && openPortfolio(portfolio)}
                    >
                      Open book
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => portfolio && setRenaming(portfolio)}
                    >
                      Rename
                    </Button>
                    {!summary.isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrimaryPortfolio(summary.id)}
                      >
                        Make primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      disabled={!canDelete}
                      title={
                        canDelete
                          ? "Delete book"
                          : "You must keep at least one book"
                      }
                      onClick={() => portfolio && setDeleting(portfolio)}
                      aria-label={`Delete ${summary.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PortfolioNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create portfolio"
        description="Give this book a name so you can find it on Invest."
        confirmLabel="Create book"
        onConfirm={handleCreate}
        isSubmitting={isCreating}
      />

      <PortfolioNameDialog
        open={Boolean(renaming)}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Rename portfolio"
        description="Update the display name for this book."
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
    </div>
  );
}
