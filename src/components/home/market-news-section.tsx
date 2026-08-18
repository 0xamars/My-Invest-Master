"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNewsTime } from "@/lib/market/format";
import type { MarketNewsItem, NewsResponse } from "@/types/market";
import { cn } from "@/lib/utils";

function NewsList({ items }: { items: MarketNewsItem[] }) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No headlines available right now.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/70">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-4 py-4 transition-colors hover:bg-muted/30"
          >
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt=""
                className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-border/70"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted ring-1 ring-border/70">
                <Newspaper className="size-5 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                {item.title}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{item.publisher}</span>
                <span>·</span>
                <span>{formatNewsTime(item.publishedAt)}</span>
                <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function MarketNewsSection() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function loadNews(isRefresh = false) {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await fetch("/api/news");
      if (!response.ok) throw new Error("Failed to load news");
      const json = (await response.json()) as NewsResponse;
      setData(json);
      setError(null);
    } catch {
      setError("Could not load market news.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadNews();
  }, []);

  return (
    <Card className="budget-panel gap-0 py-0 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 py-4">
        <div>
          <CardTitle className="text-sm">Headlines</CardTitle>
          <CardDescription>
            Stocks and crypto from Yahoo Finance.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          onClick={() => void loadNews(true)}
          disabled={isLoading || isRefreshing}
          title="Refresh news"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 size-4 animate-spin" />
            Loading headlines…
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : (
          <Tabs defaultValue="stocks">
            <TabsList>
              <TabsTrigger value="stocks">Stocks</TabsTrigger>
              <TabsTrigger value="crypto">Crypto</TabsTrigger>
            </TabsList>
            <TabsContent value="stocks" className="mt-4">
              <NewsList items={data?.stockNews ?? []} />
            </TabsContent>
            <TabsContent value="crypto" className="mt-4">
              <NewsList items={data?.cryptoNews ?? []} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
