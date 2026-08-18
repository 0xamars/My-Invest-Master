import { NextResponse } from "next/server";
import { getNarrativeTimeoutMs, resolveAiFeature } from "@/lib/ai/config";
import { getNarrativeBundle } from "@/lib/analysis/narrative/generate";
import { fallbackNarrativeBundle } from "@/lib/analysis/narrative/parse";
import type { NarrativeContext } from "@/lib/analysis/narrative/types";
import { requireAssistantAuth } from "@/lib/assistant/auth";
import { checkAssistantRateLimit } from "@/lib/assistant/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

function isContext(value: unknown): value is NarrativeContext {
  if (!value || typeof value !== "object") return false;
  const o = value as Partial<NarrativeContext>;
  return typeof o.symbol === "string" && o.symbol.trim().length > 0 && !!o.scores;
}

export async function POST(request: Request) {
  const auth = await requireAssistantAuth();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error ?? "Authentication required." },
      { status: 401 },
    );
  }

  const rate = checkAssistantRateLimit(
    `analysis-narrative:${auth.userId ?? "anon"}`,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rate.retryAfterSec}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

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

  const ctx = { ...body.context, symbol };
  const budgetMs = getNarrativeTimeoutMs() + 3_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      getNarrativeBundle(ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Narrative timed out")),
          budgetMs,
        );
      }),
    ]);
    return NextResponse.json(result);
  } catch (error) {
    const timedOut =
      error instanceof Error && /timed out/i.test(error.message);
    if (!timedOut) {
      console.error("Narrative bundle error:", error);
    }
    const configuredModel = resolveAiFeature("analysis.narrative_bundle").config.model;
    return NextResponse.json({
      bundle: fallbackNarrativeBundle(
        timedOut
          ? "Narrative timed out. Scores above are unchanged."
          : "Narrative unavailable right now. Scores above are unchanged.",
        ctx,
      ),
      source: "fallback",
      configured: true,
      model: configuredModel,
      error: timedOut ? "timeout" : "unavailable",
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
