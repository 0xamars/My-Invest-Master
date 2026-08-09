import { NextResponse } from "next/server";
import { getNarrativeBundle } from "@/lib/analysis/narrative/generate";
import type { NarrativeContext } from "@/lib/analysis/narrative/types";

export const runtime = "nodejs";

function isContext(value: unknown): value is NarrativeContext {
  if (!value || typeof value !== "object") return false;
  const o = value as Partial<NarrativeContext>;
  return typeof o.symbol === "string" && o.symbol.trim().length > 0 && !!o.scores;
}

export async function POST(request: Request) {
  let body: { context?: unknown };
  try {
    body = (await request.json()) as { context?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isContext(body.context)) {
    return NextResponse.json(
      { error: "A valid narrative context is required." },
      { status: 400 },
    );
  }

  const symbol = body.context.symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  try {
    const result = await getNarrativeBundle({ ...body.context, symbol });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Narrative bundle error:", error);
    return NextResponse.json(
      { error: "Failed to build narrative." },
      { status: 500 },
    );
  }
}
