import { fmpFetch } from "@/lib/market-data/fmp/client";
import { mapFmpQuotePayload, type FmpQuote } from "@/lib/market-data/fmp/quote";

/** Stable batch-quote accepts a comma-separated `symbols` list. */
const BATCH_SIZE = 50;
const BATCH_CONCURRENCY = 4;
/** Match the warehouse quote TTL so a burst shares one response. */
const BATCH_REVALIDATE_SEC = 300;

export type BatchQuoteResult = {
  quotes: FmpQuote[];
  /** Symbols whose chunk failed. Do not negative-cache these. */
  failed: string[];
};

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function fetchChunk(symbols: string[]): Promise<FmpQuote[]> {
  const data = await fmpFetch<unknown>({
    path: "/batch-quote",
    query: { symbols: symbols.join(",") },
    revalidate: BATCH_REVALIDATE_SEC,
  });
  return mapFmpQuotePayload(data, symbols[0] ?? "");
}

/**
 * One FMP call per chunk of symbols. Failed chunks are listed so callers
 * can serve a stale warehouse row instead of treating the symbol as empty.
 */
export async function fetchFmpBatchQuotes(
  symbols: string[],
): Promise<BatchQuoteResult> {
  const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].filter(
    Boolean,
  );
  const quotes: FmpQuote[] = [];
  const failed: string[] = [];
  const batches = chunk(unique, BATCH_SIZE);

  for (let index = 0; index < batches.length; index += BATCH_CONCURRENCY) {
    const slice = batches.slice(index, index + BATCH_CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (batch) => {
        try {
          return { batch, quotes: await fetchChunk(batch), ok: true as const };
        } catch {
          return { batch, quotes: [] as FmpQuote[], ok: false as const };
        }
      }),
    );
    for (const result of results) {
      if (!result.ok) {
        failed.push(...result.batch);
        continue;
      }
      quotes.push(...result.quotes);
    }
  }

  return { quotes, failed };
}
