"use client";

import { useMemo, useState } from "react";
import { Plus, RefreshCw, TrendingUp } from "lucide-react";
import { AddTransactionDialog } from "@/components/portfolio/add-transaction-dialog";
import { BookConcentrationBar, BookTable } from "@/components/invest/invest-book";
import {
  RetireEmptyState,
  RetirePageHeader,
  RetirePanel,
} from "@/components/retirement/retire-ui";
import { TickerLookup } from "@/components/ticker/ticker-lookup";
import { Button } from "@/components/ui/button";
import { usePortfolioPlans } from "@/contexts/portfolio-plans-context";
import { useBookTickerQuotes } from "@/hooks/use-book-ticker-quotes";
import { buildBookRows } from "@/lib/ticker/book";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import type { AddTransactionInput } from "@/types/portfolio";

export function InvestHomeContent() {
  const {
    primaryPortfolio,
    activePortfolio,
    isLoaded,
    addTransaction,
    createPortfolio,
    setActivePortfolioId,
  } = usePortfolioPlans();
  const book = primaryPortfolio ?? activePortfolio;
  const holdings = useMemo(
    () => (book?.holdings ?? []).filter(isHoldingVisible),
    [book],
  );
  const stockSymbols = useMemo(
    () => holdings.filter((item) => item.type === "stock").map((item) => item.symbol),
    [holdings],
  );
  const { quotes } = useBookTickerQuotes(stockSymbols);
  const rows = useMemo(() => buildBookRows(holdings, quotes), [holdings, quotes]);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  async function ensureBook() {
    if (book) {
      setActivePortfolioId(book.id);
      return book;
    }
    setCreating(true);
    try {
      const created = await createPortfolio("Book");
      return created;
    } finally {
      setCreating(false);
    }
  }

  async function onAddClick() {
    const next = await ensureBook();
    if (next) setAddOpen(true);
  }

  function onAdd(input: AddTransactionInput) {
    if (book) setActivePortfolioId(book.id);
    addTransaction(input);
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <RefreshCw className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <RetirePageHeader
        title="Invest"
        description="The public-stock book. Search a name or ticker."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void onAddClick()}
            disabled={creating}
          >
            <Plus className="size-4" />
            Add a name
          </Button>
        }
      />

      <TickerLookup />

      {rows.length === 0 ? (
        <div className="glass-card">
          <RetireEmptyState
            icon={<TrendingUp className="size-5" />}
            title="The book is empty."
            description="Search still works. Add a public stock when you want a weight on the page. Missing cache prints Unknown."
          />
        </div>
      ) : (
        <RetirePanel className="px-5 py-4">
          <h2 className="text-sm font-semibold">Book</h2>
          <div className="mt-4">
            <BookConcentrationBar rows={rows} />
          </div>
          <div className="mt-5">
            <BookTable rows={rows} />
          </div>
        </RetirePanel>
      )}

      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={onAdd}
        holdings={book?.holdings ?? []}
      />
    </div>
  );
}
