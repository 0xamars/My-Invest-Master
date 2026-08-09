/** Retail SBC burden label from SBC/revenue — not a score dump. */
export function sbcBurdenLabel(
  sbcToRevenue: number | null | undefined,
  highEquityComp: boolean,
): "low" | "normal" | "high" | null {
  if (sbcToRevenue == null || !Number.isFinite(sbcToRevenue) || sbcToRevenue < 0) {
    return null;
  }
  if (highEquityComp) {
    if (sbcToRevenue <= 0.04) return "low";
    if (sbcToRevenue <= 0.18) return "normal";
    return "high";
  }
  if (sbcToRevenue <= 0.02) return "low";
  if (sbcToRevenue <= 0.08) return "normal";
  return "high";
}
