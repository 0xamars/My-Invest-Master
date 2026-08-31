"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { investAssessPath } from "@/lib/invest/assess/paths";
import { normalizeTickerSymbol } from "@/lib/ticker/symbol";
import type { AssetCatalogItem } from "@/types/portfolio";

export function AssessLandingSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const raw = query.trim();
    if (!raw) {
      setError("Enter a name or ticker.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/assets/search?q=${encodeURIComponent(raw)}&type=stock`,
      );
      let symbol = normalizeTickerSymbol(raw);
      if (response.ok) {
        const payload = (await response.json()) as { results?: AssetCatalogItem[] };
        const results = payload.results ?? [];
        const ticker = normalizeTickerSymbol(raw);
        if (ticker) {
          const exact = results.find((item) => item.symbol === ticker);
          if (exact) symbol = exact.symbol;
        }
        if (!symbol && results[0]?.symbol) symbol = results[0].symbol;
      }
      if (!symbol) {
        setError("Enter a public name or ticker.");
        return;
      }
      router.push(investAssessPath(symbol));
    } catch {
      setError("Search failed — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Name or ticker"
          aria-label="Search a public stock to assess"
          className="h-11 pl-10 text-sm"
          autoCapitalize="characters"
          disabled={pending}
        />
      </div>
      {error ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
      ) : null}
    </form>
  );
}
