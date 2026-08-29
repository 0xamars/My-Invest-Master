"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandStill } from "@/components/brand/brand-still";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { INVEST_EMPTY_NO_BOOK } from "@/lib/journey/empty-states";
import { BRAND, BRAND_SIZE } from "@/lib/brand/assets";
import { displayCurrencyOrDefault } from "@/lib/journey/first-run";
import {
  FEATURED_DISPLAY_CURRENCIES,
  getCurrencyMeta,
  getCurrencySymbol,
  listDisplayCurrencies,
  type DisplayCurrency,
} from "@/types/currency";

function currenciesForSelect(): DisplayCurrency[] {
  const featured = new Set<DisplayCurrency>(FEATURED_DISPLAY_CURRENCIES);
  const rest = listDisplayCurrencies()
    .map((item) => item.code)
    .filter((code) => !featured.has(code));
  return Array.from(new Set([...FEATURED_DISPLAY_CURRENCIES, ...rest]));
}

export function FirstBookWizard({
  onCreate,
  isSubmitting = false,
}: {
  onCreate: (input: { name: string; currency: DisplayCurrency }) => void | Promise<void>;
  isSubmitting?: boolean;
}) {
  const { profile } = useMoneyProfile();
  const { currency: displayCurrency } = useDisplayCurrency();
  const defaultCurrency = displayCurrencyOrDefault(
    profile?.currency ?? displayCurrency,
  );
  const [name, setName] = useState("Book");
  const [currency, setCurrency] = useState<DisplayCurrency>(defaultCurrency);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => currenciesForSelect(), []);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name the book.");
      return;
    }
    setError(null);
    await onCreate({ name: trimmed, currency });
  }

  return (
    <div
      className="surface-card flex flex-1 flex-col gap-4 overflow-hidden px-0 py-0"
      data-first-book-wizard="1"
      data-empty-state="invest-no-book"
    >
      <BrandStill
        src={BRAND.emptyInvest}
        alt=""
        width={BRAND_SIZE.emptyInvest.width}
        height={BRAND_SIZE.emptyInvest.height}
        className="rounded-b-none border-0 border-b"
        imageClassName="h-44 object-cover object-center sm:h-52"
        sizes="(min-width: 640px) 40rem, 100vw"
      />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            First book
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {INVEST_EMPTY_NO_BOOK.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {INVEST_EMPTY_NO_BOOK.description}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="first-book-name">Name</Label>
            <Input
              id="first-book-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isSubmitting) {
                  void handleSubmit();
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="first-book-currency">Currency</Label>
            <Select
              value={currency}
              onValueChange={(value) => {
                if (value) setCurrency(value as DisplayCurrency);
              }}
            >
              <SelectTrigger id="first-book-currency" className="w-full">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {options.map((code) => (
                  <SelectItem key={code} value={code}>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {getCurrencySymbol(code)}
                      </span>
                      <span className="font-medium">{code}</span>
                      <span className="text-muted-foreground">
                        {getCurrencyMeta(code).name}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Create the book
          </Button>
          <Button
            type="button"
            variant="outline"
            render={<Link href={INVEST_EMPTY_NO_BOOK.learnHref} />}
          >
            {INVEST_EMPTY_NO_BOOK.learnLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
