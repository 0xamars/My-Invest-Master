export {
  INVEST_ASSESS_PATH,
  investAssessPath,
} from "@/lib/chrome/nav";

export function buildAssessHref(
  symbol: string,
  type: "stock" | "crypto" = "stock",
): string {
  const base = `/invest/assess/${encodeURIComponent(symbol.toUpperCase())}`;
  if (type === "crypto") {
    return `${base}?type=crypto`;
  }
  return base;
}
