"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, TrendingUp } from "lucide-react";
import { FirstBookWizard } from "@/components/journey/first-book-wizard";
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
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { explainAddHoldingFields } from "@/lib/journey/density";
import { INVEST_EMPTY_BOOK } from "@/lib/journey/empty-states";
import { shouldOfferFirstBookWizard } from "@/lib/journey/first-run";
import { buildBookRows } from "@/lib/ticker/book";
import { isHoldingVisible } from "@/lib/portfolio/transactions";
import type { DisplayCurrency } from "@/types/currency";
import type { AddTransactionInput } from "@/types/portfolio";

export function InvestHomeContent() {
  const {
    primaryPortfolio,
    activePortfolio,
    isLoaded,
    portfolios,
    addTransaction,
    createPortfolio,
    setActivePortfolioId,
  } = usePortfolioPlans();
  const { profile } = useMoneyProfile();
  const { setCurrency } = useDisplayCurrency();
  const book = primaryPortfolio ?? activePortfolio ?? portfolios[0] ?? null;
  const offerFirstBook = shouldOfferFirstBookWizard(portfolios);
  const explainFields = explainAddHoldingFields(profile);
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

  async function onCreateFirstBook(input: {
    name: string;
    currency: DisplayCurrency;
  }) {
    setCreating(true);
    try {
      setCurrency(input.currency);
      await createPortfolio(input.name);
    } finally {
      setCreating(false);
    }
  }

  async function onAddClick() {
    if (offerFirstBook || !book) return;
    setActivePortfolioId(book.id);
    setAddOpen(true);
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
          offerFirstBook ? null : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void onAddClick()}
              disabled={creating}
            >
              <Plus className="size-4" />
              Add a name
            </Button>
          )
        }
      />

      <TickerLookup />

      {offerFirstBook ? (
        <FirstBookWizard
          onCreate={onCreateFirstBook}
          isSubmitting={creating}
        />
      ) : rows.length === 0 ? (
        <div className="glass-card" data-empty-state="invest">
          <RetireEmptyState
            icon={<TrendingUp className="size-5" />}
            title={INVEST_EMPTY_BOOK.title}
            description={INVEST_EMPTY_BOOK.description}
            actions={
              <>
                <Button
                  onClick={() => void onAddClick()}
                  disabled={creating}
                >
                  <Plus className="size-4" />
                  {INVEST_EMPTY_BOOK.addLabel}
                </Button>
                <Button
                  variant="outline"
                  render={<Link href={INVEST_EMPTY_BOOK.learnHref} />}
                >
                  {INVEST_EMPTY_BOOK.learnLabel}
                </Button>
              </>
            }
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
        explainFields={explainFields}
      />
    </div>
  );
}
