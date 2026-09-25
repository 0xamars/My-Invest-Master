"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { InvestShelf, PageLoading } from "@/components/layout/page-loading";
import { InvestToolsNav } from "@/components/layout/invest-tools-nav";
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
import { INVEST_EARLY_OPP_PATH } from "@/lib/chrome/nav";
import { shouldOfferFirstBookWizard } from "@/lib/journey/first-run";
import { buildBookRows, formatBookCacheLine } from "@/lib/ticker/book";
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
  const {
    quotes,
    isLoaded: quotesLoaded,
    error: quoteError,
  } = useBookTickerQuotes(stockSymbols);
  const rows = useMemo(() => buildBookRows(holdings, quotes), [holdings, quotes]);
  const cacheLine = useMemo(
    () => formatBookCacheLine(Object.values(quotes), { isLoaded: quotesLoaded }),
    [quotes, quotesLoaded],
  );
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
    return <PageLoading label="Loading Invest" layout="cards" />;
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5">
      <InvestToolsNav />
      <RetirePageHeader
        title="Invest"
        description="The public-stock book. Search a name or ticker."
        action={
          offerFirstBook ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="btn-quiet"
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

      <Link href={INVEST_EARLY_OPP_PATH} className="block">
        <RetirePanel className="px-4 py-3 transition-colors hover:bg-muted/20 sm:px-5">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Decision aid
          </p>
          <h2 className="mt-1 text-sm font-semibold">16-step framework</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Early Opp — secular trend, financials, moat, then timing. Search a
            ticker and see pass, soft, fail, or unknown on each step.
          </p>
        </RetirePanel>
      </Link>

      {offerFirstBook ? (
        <>
          <RetirePanel className="px-4 py-4 sm:px-5">
            <FirstBookWizard
              onCreate={onCreateFirstBook}
              isSubmitting={creating}
            />
          </RetirePanel>
          <InvestShelf />
        </>
      ) : rows.length === 0 ? (
        <>
          <RetirePanel className="px-4 py-4 sm:px-5" data-empty-state="invest">
            <RetireEmptyState
              mark="invest"
              title={INVEST_EMPTY_BOOK.title}
              description={INVEST_EMPTY_BOOK.description}
              actions={
                <Button
                  onClick={() => void onAddClick()}
                  disabled={creating}
                >
                  <Plus className="size-4" />
                  {INVEST_EMPTY_BOOK.addLabel}
                </Button>
              }
            />
          </RetirePanel>
          <InvestShelf />
        </>
      ) : (
        <RetirePanel className="px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold">Book</h2>
          {quoteError ? (
            <p className="mt-1 text-xs text-muted-foreground">{quoteError}</p>
          ) : null}
          {cacheLine ? (
            <p className="mt-1 text-xs text-muted-foreground" data-book-cache="1">
              {cacheLine}
            </p>
          ) : null}
          <div className="mt-3">
            <BookConcentrationBar rows={rows} />
          </div>
          <div className="mt-3">
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
