"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { formatNewsTime } from "@/lib/market/format";
import type { MarketNewsItem, NewsResponse } from "@/types/market";

export function BookNewsSection({ symbols }: { symbols: string[] }) {
  const [items, setItems] = useState<MarketNewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const symbolKey = symbols.join(",");

  useEffect(() => {
    if (!symbolKey) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    const params = new URLSearchParams({ symbols: symbolKey });
    void fetch(`/api/news?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("news");
        return (await response.json()) as NewsResponse;
      })
      .then((json) => {
        if (!controller.signal.aborted) setItems(json.stockNews ?? []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [symbolKey]);

  if (symbols.length === 0) return null;

  return (
    <div>
      <p className="budget-metric-label">Book headlines</p>
      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading headlines…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No headlines on names in the book.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {items.slice(0, 4).map((item) => (
            <li key={item.id}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 py-2 hover:text-foreground"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="size-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                    <Newspaper className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.publisher} · {formatNewsTime(item.publishedAt)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
