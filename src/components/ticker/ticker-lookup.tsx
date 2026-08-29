"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { investTickerPath, normalizeTickerSymbol } from "@/lib/ticker/symbol";
import { cn } from "@/lib/utils";
import type { AssetCatalogItem } from "@/types/portfolio";

async function resolveSymbol(raw: string): Promise<string | null> {
  const ticker = normalizeTickerSymbol(raw);
  try {
    const response = await fetch(
      `/api/assets/search?q=${encodeURIComponent(raw.trim())}&type=stock`,
    );
    if (response.ok) {
      const payload = (await response.json()) as { results?: AssetCatalogItem[] };
      const results = payload.results ?? [];
      if (ticker) {
        const exact = results.find((item) => item.symbol === ticker);
        if (exact) return exact.symbol;
      }
      if (results[0]?.symbol) return results[0].symbol;
    }
  } catch {
    // Fall through to the typed ticker.
  }
  return ticker;
}

export function TickerLookup({
  className,
  placeholder = "Name or ticker",
}: {
  className?: string;
  placeholder?: string;
}) {
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
    const symbol = await resolveSymbol(raw);
    setPending(false);
    if (!symbol) {
      setError("Enter a public name or ticker.");
      return;
    }
    router.push(investTickerPath(symbol));
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          aria-label="Search a public stock by name or ticker"
          className="h-11 pl-10 text-sm"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          disabled={pending}
        />
      </div>
      {error ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
      ) : null}
    </form>
  );
}
