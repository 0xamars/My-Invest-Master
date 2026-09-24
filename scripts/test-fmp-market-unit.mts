/**
 * FMP market-data mappers and warehouse freshness.
 *   npx tsx --tsconfig tsconfig.json scripts/test-fmp-market-unit.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { heatmapStockFromQuote } from "../src/lib/market/fetch-heatmap.ts";
import { newsForBookSymbols } from "../src/lib/market/fetch-news.ts";
import { toQuoteSymbol } from "../src/lib/market/csv.ts";
import {
  fmpNewsId,
  fmpNewsTimestamp,
  mapFmpNewsItem,
  relatedTickersFromFmpSymbol,
} from "../src/lib/market-data/fmp/news.ts";
import { mapFmpQuoteRow } from "../src/lib/market-data/fmp/quote.ts";
import {
  mapFmpSearchHit,
  mergeSearchHits,
  normalizeSearchCacheKey,
} from "../src/lib/market-data/fmp/search.ts";
import {
  toEquityHistorySymbol,
  toFmpCryptoSymbol,
} from "../src/lib/market-data/fmp/symbols.ts";
import { resolveHistorySymbol } from "../src/lib/analysis/history.ts";
import {
  classifyQuoteCache,
  fmpSymbolForRequest,
} from "../src/lib/market-data/warehouse/cached-quotes.ts";
import { DATASET_TTL_MS } from "../src/lib/market-data/warehouse/ttl.ts";
import type { IndexConstituent } from "../src/lib/market/index-config.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(toQuoteSymbol("brk.b") === "BRK-B", "share class dot becomes a dash");
assert(toQuoteSymbol("aapl") === "AAPL", "plain ticker is uppercased");
assert(toFmpCryptoSymbol("btc") === "BTCUSD", "BTC becomes BTCUSD");
assert(toFmpCryptoSymbol("ETH") === "ETHUSD", "ETH becomes ETHUSD");
assert(toFmpCryptoSymbol("sol") === "SOLUSD", "SOL becomes SOLUSD");
assert(toFmpCryptoSymbol("USDC") === "USDCUSD", "USDC becomes USDCUSD");
assert(toFmpCryptoSymbol("usdt") === "USDTUSD", "USDT becomes USDTUSD");
assert(toFmpCryptoSymbol("PYUSD") === "PYUSDUSD", "PYUSD becomes PYUSDUSD");
assert(toFmpCryptoSymbol("RLUSD") === "RLUSDUSD", "RLUSD becomes RLUSDUSD");
assert(toFmpCryptoSymbol("LUSD") === "LUSDUSD", "LUSD becomes LUSDUSD");
assert(toFmpCryptoSymbol("SUSD") === "SUSDUSD", "SUSD becomes SUSDUSD");
assert(toFmpCryptoSymbol("CUSD") === "CUSDUSD", "CUSD becomes CUSDUSD");
assert(toFmpCryptoSymbol("AUSD") === "AUSDUSD", "AUSD becomes AUSDUSD");
assert(toFmpCryptoSymbol("DUSD") === "DUSDUSD", "DUSD becomes DUSDUSD");
assert(toFmpCryptoSymbol("BTCUSD") === "BTCUSD", "BTCUSD is a known FMP pair");
assert(toFmpCryptoSymbol("BTC-USD") === "BTCUSD", "BTC-USD compacts to the FMP pair");
assert(toFmpCryptoSymbol("BTC/USDT") === "BTCUSD", "BTC/USDT compacts to the FMP pair");
assert(toFmpCryptoSymbol("BTCUSDT") === "BTCUSD", "USDT quote maps to the USD pair");
assert(toFmpCryptoSymbol("tusd") === "TUSDUSD", "TUSD becomes TUSDUSD");
assert(toFmpCryptoSymbol("FDUSD") === "FDUSDUSD", "FDUSD becomes FDUSDUSD");
assert(toFmpCryptoSymbol("BUSD") === "BUSDUSD", "BUSD becomes BUSDUSD");
assert(toFmpCryptoSymbol("PYUSDUSD") === "PYUSDUSD", "resolved stablecoin pair stays put");
assert(
  toFmpCryptoSymbol(toFmpCryptoSymbol("PYUSD")) === "PYUSDUSD",
  "stablecoin resolve is idempotent",
);
assert(toFmpCryptoSymbol("ETHUSD") === "ETHUSD", "ETHUSD is already an FMP pair");
assert(
  toFmpCryptoSymbol(toFmpCryptoSymbol("eth")) === "ETHUSD",
  "a second crypto resolve does not append USD again",
);
assert(toFmpCryptoSymbol("BTC-USDT") === "BTCUSD", "dashed USDT pair compacts to USD");
assert(toFmpCryptoSymbol("BTC/USD") === "BTCUSD", "slashed pair is already a pair");
assert(toEquityHistorySymbol("brk.b") === "BRK.B", "history key keeps the package form");

assert(
  fmpSymbolForRequest({ symbol: "brk.b", asset: "stock" }) === "BRK-B",
  "stock quotes cache under the FMP symbol",
);
assert(
  fmpSymbolForRequest({ symbol: "eth", asset: "crypto" }) === "ETHUSD",
  "crypto quotes use the FMP pair",
);
assert(
  resolveHistorySymbol("btc", "crypto") === "BTCUSD",
  "crypto charts resolve to the FMP pair",
);
assert(
  resolveHistorySymbol("aapl", "stock") === "AAPL",
  "stock charts keep the equity symbol",
);

const freshAt = new Date().toISOString();
const staleAt = new Date(Date.now() - 10 * 60_000).toISOString();
assert(
  classifyQuoteCache({
    row: { updatedAt: freshAt, price: 12 },
    refresh: null,
  }) === "fresh",
  "quote inside TTL is fresh",
);
assert(
  classifyQuoteCache({
    row: { updatedAt: staleAt, price: 12 },
    refresh: null,
    ttlMs: DATASET_TTL_MS.quote,
  }) === "refresh",
  "quote past TTL refreshes",
);
assert(
  classifyQuoteCache({
    row: null,
    refresh: {
      status: "empty",
      errorMessage: "fmp_empty",
      checkedAt: freshAt,
    },
  }) === "empty-cached",
  "recent empty marker skips FMP",
);
assert(
  classifyQuoteCache({
    row: { updatedAt: freshAt, price: 9 },
    refresh: {
      status: "empty",
      errorMessage: "fmp_empty",
      checkedAt: freshAt,
    },
  }) === "fresh",
  "a fresh price wins over an empty marker",
);

const mapped = mapFmpQuoteRow(
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    price: 190.5,
    change: 1.25,
    changesPercentage: 0.66,
    marketCap: 2_900_000_000_000,
    volume: 40_000_000,
    yearLow: 160,
    yearHigh: 200,
  },
  "AAPL",
);
assert(mapped?.price === 190.5, "quote price maps");
assert(mapped?.changePercent === 0.66, "changesPercentage maps to changePercent");
assert(mapped?.week52High === 200, "year high maps to week52High");
assert(mapFmpQuoteRow({ symbol: "AAPL", price: 0 }, "AAPL") == null, "zero price is empty");

const meta: IndexConstituent = {
  symbol: "BRK.B",
  quoteSymbol: "BRK-B",
  name: "Berkshire Hathaway",
  sector: "Financial",
  industry: "Insurance",
};
const heat = heatmapStockFromQuote(
  {
    symbol: "BRK-B",
    name: null,
    price: 410,
    change: 2,
    changePercent: 0.5,
    marketCap: 100,
    volume: null,
    averageVolume: null,
    dayLow: null,
    dayHigh: null,
    week52Low: null,
    week52High: null,
    currency: "USD",
  },
  meta,
);
assert(heat?.symbol === "BRK.B", "heatmap keeps the constituent symbol");
assert(heat?.name === "Berkshire Hathaway", "heatmap name falls back to metadata");
assert(heat?.sector === "Financial", "heatmap sector comes from metadata");
assert(
  heatmapStockFromQuote(
    {
      symbol: "BRK-B",
      name: "x",
      price: 410,
      change: null,
      changePercent: 0.5,
      marketCap: 1,
      volume: null,
      averageVolume: null,
      dayLow: null,
      dayHigh: null,
      week52Low: null,
      week52High: null,
      currency: "USD",
    },
    meta,
  ) == null,
  "heatmap skips quotes without a change",
);
assert(
  relatedTickersFromFmpSymbol("BRK.B").includes("BRK-B"),
  "share-class news tickers use the quote symbol",
);

const news = mapFmpNewsItem({
  symbol: "BTCUSD",
  publishedDate: "2026-01-15 21:05:14",
  publisher: "Reuters",
  title: "Bitcoin moves",
  image: "https://cdn.example/btc.jpg",
  site: "reuters.com",
  url: "https://news.example/btc",
});
assert(news?.id === "https://news.example/btc", "news id is the url");
assert(news?.publisher === "Reuters", "news publisher maps");
assert(news?.thumbnailUrl === "https://cdn.example/btc.jpg", "news image maps");
assert(news?.publishedAt.startsWith("2026-01-15T21:05:14"), "news time becomes ISO");
assert(
  news?.relatedTickers?.includes("BTC") === true &&
    news.relatedTickers.includes("BTCUSD"),
  "crypto news keeps the pair and the base ticker",
);
assert(mapFmpNewsItem({ title: "No link" }) == null, "news without a link is dropped");
assert(fmpNewsId({ title: "T", publishedDate: "D", symbol: "AAPL" }) === "AAPL|D|T", "news id fallback");
assert(relatedTickersFromFmpSymbol("ETHUSD").join(",") === "ETHUSD,ETH", "ETH pair splits");
assert(fmpNewsTimestamp("not-a-date") === new Date(0).toISOString(), "bad news time is epoch");

const book = newsForBookSymbols(
  [
    news!,
    {
      id: "other",
      title: "Other",
      publisher: "X",
      link: "https://news.example/other",
      publishedAt: news!.publishedAt,
      relatedTickers: ["AAPL"],
    },
  ],
  ["BTC"],
  4,
);
assert(book.length === 1 && book[0]?.id === news?.id, "book news matches the base ticker");

const apple = mapFmpSearchHit({
  symbol: "AAPL",
  name: "Apple Inc.",
  currency: "USD",
  exchange: "NASDAQ",
  type: "stock",
});
const etf = mapFmpSearchHit({
  symbol: "SPY",
  name: "SPDR S&P 500",
  exchangeFullName: "NYSE Arca",
  type: "etf",
});
const coin = mapFmpSearchHit({
  symbol: "BTCUSD",
  name: "Bitcoin",
  type: "crypto",
});
assert(apple?.category === "Equity" && apple.subCategory === "NASDAQ", "stock search hit");
assert(etf?.category === "ETF" && etf.subCategory === "NYSE Arca", "etf search hit");
assert(coin == null, "crypto hits stay out of stock search");
assert(
  mergeSearchHits([apple!, apple!, etf!], 8).map((item) => item.symbol).join(",") ===
    "AAPL,SPY",
  "search hits dedupe",
);
assert(normalizeSearchCacheKey("  Apple   Inc ") === "apple inc", "search cache key folds space");

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx|mts)$/.test(entry)) files.push(path);
  }
  return files;
}

const packageJson = readFileSync("package.json", "utf8");
assert(!packageJson.includes("yahoo-finance2"), "package.json drops yahoo-finance2");

for (const file of walk("src")) {
  const text = readFileSync(file, "utf8");
  assert(!text.includes("yahoo-finance2"), `${file} must not import yahoo-finance2`);
  assert(!text.includes("allowYahooFallback"), `${file} must not keep the Yahoo fallback switch`);
  assert(!text.includes("query1.finance.yahoo"), `${file} must not call Yahoo`);
}

const priceFiles = walk("src/lib/portfolio/prices").concat([
  "src/lib/analysis/quote.ts",
]);
for (const file of priceFiles) {
  const text = readFileSync(file, "utf8");
  assert(!text.includes("coingecko.com"), `${file} prices must not call CoinGecko`);
}

console.log("fmp market unit tests passed");
