import { fetchFmpDailyBars } from "@/lib/market-data/fmp/history";
import type { DailyClose } from "@/lib/invest/vs-spy";

const SPY = "SPY";

export async function fetchSpyDailyCloses(from?: string): Promise<DailyClose[]> {
  const bars = await fetchFmpDailyBars(SPY, from ? { from } : undefined);
  return bars.map((bar) => ({ time: bar.time, close: bar.close }));
}
