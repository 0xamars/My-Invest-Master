/**
 * Since-bought / closed-fill return vs SPY. Per window only —
 * not a book-level TWR.
 */

export type VsSpyWindow = {
  from: string;
  to: string;
  holdingReturnPercent: number | null;
  spyReturnPercent: number | null;
  vsSpyPercent: number | null;
};

export type DailyClose = {
  time: number;
  close: number;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  return DATE_RE.test(value.trim());
}

export function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(DATE_RE) ?? value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function returnPercent(start: number, end: number): number | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === 0) {
    return null;
  }
  return ((end - start) / Math.abs(start)) * 100;
}

export function closeOnOrAfter(
  bars: DailyClose[],
  date: string,
): number | null {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start)) return null;
  for (const bar of bars) {
    if (bar.time >= start && Number.isFinite(bar.close) && bar.close > 0) {
      return bar.close;
    }
  }
  return null;
}

export function closeOnOrBefore(
  bars: DailyClose[],
  date: string,
): number | null {
  const end = Date.parse(`${date}T23:59:59.999Z`);
  if (!Number.isFinite(end)) return null;
  let found: number | null = null;
  for (const bar of bars) {
    if (bar.time <= end && Number.isFinite(bar.close) && bar.close > 0) {
      found = bar.close;
    }
  }
  return found;
}

export function computeVsSpy(input: {
  from: string;
  to: string;
  holdingReturnPercent: number | null;
  spyStart: number | null;
  spyEnd: number | null;
}): VsSpyWindow {
  const holdingReturnPercent =
    input.holdingReturnPercent != null && Number.isFinite(input.holdingReturnPercent)
      ? input.holdingReturnPercent
      : null;
  const spyReturnPercent =
    input.spyStart != null && input.spyEnd != null
      ? returnPercent(input.spyStart, input.spyEnd)
      : null;
  const vsSpyPercent =
    holdingReturnPercent != null && spyReturnPercent != null
      ? holdingReturnPercent - spyReturnPercent
      : null;

  return {
    from: input.from,
    to: input.to,
    holdingReturnPercent,
    spyReturnPercent,
    vsSpyPercent,
  };
}

export function computeVsSpyFromBars(input: {
  from: string;
  to: string;
  holdingReturnPercent: number | null;
  bars: DailyClose[];
}): VsSpyWindow {
  return computeVsSpy({
    from: input.from,
    to: input.to,
    holdingReturnPercent: input.holdingReturnPercent,
    spyStart: closeOnOrAfter(input.bars, input.from),
    spyEnd: closeOnOrBefore(input.bars, input.to),
  });
}

/** One fact line. Numbers only — no score, no “beat the market”. */
export function vsSpyFactLine(vs: VsSpyWindow): string {
  const hold =
    vs.holdingReturnPercent != null
      ? `${vs.holdingReturnPercent >= 0 ? "+" : ""}${vs.holdingReturnPercent.toFixed(1)}%`
      : "—";
  const spy =
    vs.spyReturnPercent != null
      ? `${vs.spyReturnPercent >= 0 ? "+" : ""}${vs.spyReturnPercent.toFixed(1)}%`
      : "—";
  const delta =
    vs.vsSpyPercent == null
      ? null
      : `${vs.vsSpyPercent >= 0 ? "+" : ""}${vs.vsSpyPercent.toFixed(1)} pts`;
  return `Since ${vs.from} · ${hold} vs SPY ${spy}${delta ? ` (${delta})` : ""}`;
}
