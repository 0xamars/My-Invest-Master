import { formatTickerField } from "@/lib/ticker/format";
import type { TapePoint } from "@/lib/invest/assess/types";

function money(value: number | null): string {
  return formatTickerField({ label: "", value, kind: "money" });
}

function direction(values: Array<number | null>): "up" | "down" | "flat" | "mixed" {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return "mixed";
  const first = nums[0]!;
  const last = nums[nums.length - 1]!;
  if (first === 0 && last === 0) return "flat";
  const base = Math.abs(first) || Math.abs(last);
  if (base === 0) return "flat";
  const change = (last - first) / base;
  if (change >= 0.15) return "up";
  if (change <= -0.15) return "down";
  return "flat";
}

function dirWord(dir: ReturnType<typeof direction>): string {
  if (dir === "up") return "rose";
  if (dir === "down") return "fell";
  if (dir === "flat") return "was roughly flat";
  return "was uneven";
}

/**
 * 2–5 sentence read on the fiscal-year tape. Uses only loaded series.
 */
export function buildTapeRead(input: {
  name: string | null;
  symbol: string;
  annual: TapePoint[];
  isOperatingTape: boolean;
}): string {
  const label =
    input.name && input.symbol
      ? `${input.name} (${input.symbol})`
      : input.symbol;

  if (!input.isOperatingTape) {
    return `${label} is not an operating-company tape — use price and structure, not margin stories.`;
  }

  if (input.annual.length === 0) {
    return `${label} has no annual fiscal tape loaded yet.`;
  }

  const rev = input.annual.map((p) => p.revenue);
  const ni = input.annual.map((p) => p.netIncome);
  const ocf = input.annual.map((p) => p.operatingCashFlow);
  const fcf = input.annual.map((p) => p.freeCashFlow);
  const cash = input.annual.map((p) => p.cashAndSti);
  const debt = input.annual.map((p) => p.totalDebt);

  const parts: string[] = [];
  const revDir = direction(rev);
  const latestRev = rev[rev.length - 1];
  const oldestRev = rev.find((v) => v != null);
  if (latestRev != null && oldestRev != null) {
    parts.push(
      `Revenue ${dirWord(revDir)} from ${money(oldestRev)} to ${money(latestRev)} across ${input.annual.length} fiscal years.`,
    );
  }

  const niDir = direction(ni);
  const latestNi = ni[ni.length - 1];
  if (latestNi != null) {
    parts.push(`Net income ${dirWord(niDir)} and finished at ${money(latestNi)}.`);
  }

  const ocfDir = direction(ocf);
  const fcfDir = direction(fcf);
  if (ocf.some((v) => v != null) || fcf.some((v) => v != null)) {
    parts.push(
      `Operating cash flow ${dirWord(ocfDir)} while free cash flow ${dirWord(fcfDir)}.`,
    );
  }

  const latestCash = cash[cash.length - 1];
  const latestDebt = debt[debt.length - 1];
  if (latestCash != null || latestDebt != null) {
    const cashPart = latestCash != null ? money(latestCash) : "unknown cash";
    const debtPart = latestDebt != null ? money(latestDebt) : "unknown debt";
    parts.push(`Latest balance sheet shows ${cashPart} cash plus short-term investments against ${debtPart} total debt.`);
  }

  return parts.slice(0, 5).join(" ");
}

export function buildQuarterlyChangeNote(quarterly: TapePoint[]): string | null {
  if (quarterly.length < 2) return null;
  const latest = quarterly[quarterly.length - 1]!;
  const prior = quarterly[quarterly.length - 2]!;
  const changes: string[] = [];

  if (latest.revenue != null && prior.revenue != null) {
    const delta = latest.revenue - prior.revenue;
    changes.push(`revenue ${delta >= 0 ? "up" : "down"} to ${money(latest.revenue)}`);
  }
  if (latest.netIncome != null && prior.netIncome != null) {
    changes.push(`net income at ${money(latest.netIncome)}`);
  }
  if (latest.freeCashFlow != null && prior.freeCashFlow != null) {
    changes.push(`free cash flow at ${money(latest.freeCashFlow)}`);
  }

  if (changes.length === 0) return null;
  return `Latest quarter versus prior: ${changes.join("; ")}.`;
}
