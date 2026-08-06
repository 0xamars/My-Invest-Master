/**
 * Detect digital-asset / bitcoin treasury companies (MSTR-like).
 * Ticker-agnostic: profile text + cash-flow / mark-to-market distortions.
 * Must not classify pure software ops or crypto exchanges without treasury evidence.
 */

export type DigitalAssetTreasuryDetection = {
  isTreasury: boolean;
  reasons: string[];
};

const TREASURY_KEYWORD_RE =
  /\b(bitcoin\s+treasury|btc\s+treasury|digital[\s-]?asset\s+treasury|crypto(?:currency)?\s+treasury|bitcoin\s+holding\s+compan(?:y|ies)|digital[\s-]?asset\s+holding\s+compan(?:y|ies)|treasury\s+compan(?:y|ies)\s+.{0,40}\bbitcoin|bitcoin.{0,40}treasury\s+compan(?:y|ies))\b/i;

const DIGITAL_ASSET_CONTEXT_RE =
  /\b(bitcoin|btc|crypto(?:currency)?|digital[\s-]?assets?)\b/i;

/** Exchanges / trading venues — not treasury vehicles unless treasury keywords also match. */
const CRYPTO_EXCHANGE_RE =
  /\b(crypto(?:currency)?\s+exchange|digital[\s-]?asset\s+exchange|bitcoin\s+exchange|spot\s+crypto\s+exchange|crypto\s+trading\s+platform|digital[\s-]?asset\s+trading)\b/i;

const EXCHANGE_INDUSTRY_RE =
  /\b(exchange|capital\s+markets|financial\s+data\s+&\s+stock\s+exchanges)\b/i;

function blob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

function hasTreasuryKeywords(text: string): boolean {
  return TREASURY_KEYWORD_RE.test(text);
}

function isCryptoExchangeWithoutTreasury(text: string): boolean {
  if (hasTreasuryKeywords(text)) return false;
  if (CRYPTO_EXCHANGE_RE.test(text)) return true;
  // Industry/sector "Capital Markets" alone is too broad; require crypto context + exchange-ish industry.
  return (
    DIGITAL_ASSET_CONTEXT_RE.test(text) && EXCHANGE_INDUSTRY_RE.test(text)
  );
}

/**
 * Extreme FCF vs revenue with weak OCF — classic treasury / non-op cash distortion.
 * Thresholds are ticker-agnostic; used only with treasury keywords or digital-asset context.
 */
export function hasTreasuryCashFlowDistortion(input: {
  freeCashflow: number | null | undefined;
  operatingCashflow: number | null | undefined;
  totalRevenue: number | null | undefined;
}): boolean {
  const { freeCashflow: fcf, operatingCashflow: ocf, totalRevenue: rev } =
    input;
  if (fcf == null || rev == null || !(rev > 0) || !(fcf > 0)) return false;
  const fcfToRev = fcf / rev;
  if (fcfToRev <= 2) return false;
  // OCF much weaker than FCF (or non-positive)
  if (ocf == null || ocf <= 0) return true;
  return ocf / fcf < 0.35;
}

/**
 * Extreme |EBITDA|/revenue from non-operating marks vs tiny operating revenue.
 */
export function hasTreasuryEbitdaDistortion(input: {
  ebitda: number | null | undefined;
  totalRevenue: number | null | undefined;
}): boolean {
  const { ebitda, totalRevenue: rev } = input;
  if (ebitda == null || rev == null || !(rev > 0)) return false;
  return Math.abs(ebitda) / rev >= 5;
}

export function detectDigitalAssetTreasury(input: {
  name?: string | null;
  description?: string | null;
  industry?: string | null;
  industryKey?: string | null;
  sector?: string | null;
  sectorKey?: string | null;
  freeCashflow?: number | null;
  operatingCashflow?: number | null;
  totalRevenue?: number | null;
  ebitda?: number | null;
}): DigitalAssetTreasuryDetection {
  const text = blob([
    input.name,
    input.description,
    input.industry,
    input.industryKey,
    input.sector,
    input.sectorKey,
  ]);

  if (!text && input.freeCashflow == null && input.ebitda == null) {
    return { isTreasury: false, reasons: [] };
  }

  // Pure exchanges / trading platforms without treasury language stay on normal path.
  if (isCryptoExchangeWithoutTreasury(text)) {
    return { isTreasury: false, reasons: [] };
  }

  const reasons: string[] = [];
  const keywords = hasTreasuryKeywords(text);
  if (keywords) {
    reasons.push("Profile describes a bitcoin / digital-asset treasury business");
  }

  const cashDistortion = hasTreasuryCashFlowDistortion({
    freeCashflow: input.freeCashflow,
    operatingCashflow: input.operatingCashflow,
    totalRevenue: input.totalRevenue,
  });
  const ebitdaDistortion = hasTreasuryEbitdaDistortion({
    ebitda: input.ebitda,
    totalRevenue: input.totalRevenue,
  });
  const digitalContext = DIGITAL_ASSET_CONTEXT_RE.test(text);

  if (cashDistortion && (keywords || digitalContext)) {
    reasons.push(
      "FCF/revenue extreme with OCF much weaker than FCF — treasury cash-flow distortion",
    );
  }
  if (ebitdaDistortion && (keywords || digitalContext)) {
    reasons.push(
      "|EBITDA|/revenue extreme — non-operating marks dominate vs operating revenue",
    );
  }

  // Keywords alone are sufficient (explicit treasury company).
  if (keywords) {
    return { isTreasury: true, reasons };
  }

  // Financial extremes only with digital-asset context (and not exchange).
  if (digitalContext && (cashDistortion || ebitdaDistortion)) {
    return { isTreasury: true, reasons };
  }

  return { isTreasury: false, reasons: [] };
}

export const TREASURY_CASH_FLOW_NOTE =
  "Digital-asset treasury — OCF/FCF multiples and FCF margin are not comparable to operating software companies; suppressed for scoring.";
