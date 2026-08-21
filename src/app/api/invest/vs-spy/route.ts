import { NextResponse } from "next/server";
import { requireAssistantAuth } from "@/lib/assistant/auth";
import { fetchSpyDailyCloses } from "@/lib/invest/spy-bars";
import {
  computeVsSpyFromBars,
  normalizeIsoDate,
  type VsSpyWindow,
} from "@/lib/invest/vs-spy";
import { rateLimitJsonResponse } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type WindowInput = {
  id?: string;
  from?: string;
  to?: string;
  holdingReturnPercent?: number | null;
};

export async function POST(request: Request) {
  const auth = await requireAssistantAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error ?? "Sign in to continue." },
      { status: 401 },
    );
  }

  const limited = rateLimitJsonResponse(request, "invest-vs-spy", { max: 30 });
  if (limited) return limited;

  let body: { windows?: unknown };
  try {
    body = (await request.json()) as { windows?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.windows)) {
    return NextResponse.json({ error: "windows is required." }, { status: 400 });
  }

  const windows = body.windows
    .slice(0, 40)
    .map((item) => parseWindow(item))
    .filter((item): item is ParsedWindow => item != null);

  if (windows.length === 0) {
    return NextResponse.json({ results: [] as Array<VsSpyWindow & { id: string }> });
  }

  const earliest = windows.reduce(
    (min, item) => (item.from < min ? item.from : min),
    windows[0]!.from,
  );

  try {
    const bars = await fetchSpyDailyCloses(earliest);
    const results = windows.map((item) => ({
      id: item.id,
      ...computeVsSpyFromBars({
        from: item.from,
        to: item.to,
        holdingReturnPercent: item.holdingReturnPercent,
        bars,
      }),
    }));
    return NextResponse.json({ results });
  } catch (error) {
    console.error("vs SPY error:", error);
    return NextResponse.json(
      { error: "Failed to load SPY comparison" },
      { status: 500 },
    );
  }
}

type ParsedWindow = {
  id: string;
  from: string;
  to: string;
  holdingReturnPercent: number | null;
};

function parseWindow(value: unknown): ParsedWindow | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as WindowInput;
  const from = normalizeIsoDate(raw.from);
  const to = normalizeIsoDate(raw.to);
  if (!from || !to) return null;
  const holdingReturnPercent =
    typeof raw.holdingReturnPercent === "number" &&
    Number.isFinite(raw.holdingReturnPercent)
      ? raw.holdingReturnPercent
      : null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim().slice(0, 80)
      : `${from}:${to}`;
  return { id, from, to, holdingReturnPercent };
}
