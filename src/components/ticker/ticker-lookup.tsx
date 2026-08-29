"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { investTickerPath, normalizeTickerSymbol } from "@/lib/ticker/symbol";
import { cn } from "@/lib/utils";

export function TickerLookup({
  className,
  placeholder = "Open a public stock, e.g. NVDA",
}: {
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const symbol = normalizeTickerSymbol(query);
    if (!symbol) {
      setError("Enter a public ticker, e.g. NVDA.");
      return;
    }
    setError(null);
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
          aria-label="Open a public stock ticker"
          className="h-11 pl-10 text-sm"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      {error ? <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p> : null}
    </form>
  );
}
