import { NextResponse } from "next/server";
import { complete, isAiConfigured, logAiFallback } from "@/lib/ai";
import { AiNotConfiguredError, AiRequestError } from "@/lib/ai/types";
import {
  buildCompanyBlurbUserMessage,
  COMPANY_BLURB_RETRY_SYSTEM,
  COMPANY_BLURB_SYSTEM,
} from "@/lib/ai/prompts/company-blurb";
import {
  finalizeCompanyBlurb,
  truncateProfileDescription,
} from "@/lib/analysis/company-blurb";

export const runtime = "nodejs";

type BlurbBody = {
  symbol?: unknown;
  name?: unknown;
  sector?: unknown;
  industry?: unknown;
  description?: unknown;
  country?: unknown;
};

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function POST(request: Request) {
  let body: BlurbBody;
  try {
    body = (await request.json()) as BlurbBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const symbol = asTrimmed(body.symbol, 16)?.toUpperCase() ?? "";
  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required." }, { status: 400 });
  }

  const name = asTrimmed(body.name, 160);
  const sector = asTrimmed(body.sector, 80);
  const industry = asTrimmed(body.industry, 120);
  const country = asTrimmed(body.country, 80);
  const description = asTrimmed(body.description, 4000);
  const fallback = truncateProfileDescription(description);
  const userContent = buildCompanyBlurbUserMessage({
    symbol,
    name,
    sector,
    industry,
    country,
    description,
  });

  if (!isAiConfigured()) {
    logAiFallback("analysis.company_blurb", "no_key");
    return NextResponse.json({
      blurb: fallback,
      source: "fallback" as const,
      configured: false,
      error: "AI not configured",
    });
  }

  try {
    const first = await complete({
      feature: "analysis.company_blurb",
      system: COMPANY_BLURB_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
    let decided = finalizeCompanyBlurb(first.text, fallback);

    if (decided.source !== "ai") {
      const retry = await complete({
        feature: "analysis.company_blurb",
        system: COMPANY_BLURB_RETRY_SYSTEM,
        messages: [{ role: "user", content: userContent }],
      });
      decided = finalizeCompanyBlurb(retry.text, fallback);
    }

    if (decided.source !== "ai") {
      logAiFallback("analysis.company_blurb", "empty");
    }

    return NextResponse.json({
      blurb: decided.blurb,
      source: decided.source,
      configured: true,
      model: first.model,
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      logAiFallback("analysis.company_blurb", "no_key");
      return NextResponse.json({
        blurb: fallback,
        source: "fallback" as const,
        configured: false,
        error: "AI not configured",
      });
    }
    logAiFallback("analysis.company_blurb", "error");
    console.error("Company blurb error:", error);
    const message =
      error instanceof AiRequestError
        ? error.message
        : "AI blurb unavailable.";
    return NextResponse.json({
      blurb: fallback,
      source: "fallback" as const,
      configured: true,
      error: message,
    });
  }
}
