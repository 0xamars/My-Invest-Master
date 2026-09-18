export {
  INVEST_EARLY_OPP_PATH,
  investEarlyOppPath,
} from "@/lib/chrome/nav";

export function buildEarlyOppHref(symbol: string): string {
  return `/invest/early-opp/${encodeURIComponent(symbol.toUpperCase())}`;
}
