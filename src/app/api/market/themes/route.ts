import { requireAssistantAuth } from "@/lib/assistant/auth";
import { checkAssistantRateLimit } from "@/lib/assistant/rate-limit";
import {
  CUSTOM_THEME_CACHE_TTL_MS,
  getCached,
  setCached,
  THEMES_CACHE_TTL_MS,
} from "@/lib/market/themes-cache";
import {
  generateCustomTheme,
  generatePopularThemes,
} from "@/lib/market/themes-ai";
import { CUSTOM_THEME_CATALOG } from "@/types/market-themes";
import type {
  CustomThemePayload,
  MarketThemesPayload,
} from "@/types/market-themes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAssistantAuth();
  if (!auth.ok) {
    return Response.json(
      { error: auth.error ?? "Authentication required." },
      { status: 401 },
    );
  }

  const rateKey = `market-themes:${auth.userId ?? "anon"}`;
  const rate = checkAssistantRateLimit(rateKey);
  if (!rate.allowed) {
    return Response.json(
      { error: `Too many requests. Try again in ${rate.retryAfterSec}s.` },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "popular";
  const refresh = searchParams.get("refresh") === "1";

  if (mode === "catalog") {
    return Response.json({ themes: CUSTOM_THEME_CATALOG });
  }

  if (mode === "custom") {
    const themeId = searchParams.get("themeId")?.trim();
    if (!themeId) {
      return Response.json(
        { error: "themeId is required for custom mode." },
        { status: 400 },
      );
    }

    const known = CUSTOM_THEME_CATALOG.some((entry) => entry.id === themeId);
    if (!known) {
      return Response.json({ error: "Unknown themeId." }, { status: 400 });
    }

    const cacheKey = `market:custom:${themeId}`;
    if (!refresh) {
      const cached = getCached<CustomThemePayload>(cacheKey);
      if (cached) {
        return Response.json({ ...cached, source: "cache" as const });
      }
    }

    const payload = await generateCustomTheme(themeId);
    if (payload.source === "ai") {
      setCached(cacheKey, payload, CUSTOM_THEME_CACHE_TTL_MS);
    }
    return Response.json(payload);
  }

  // popular (default)
  const cacheKey = "market:popular:v1";
  if (!refresh) {
    const cached = getCached<MarketThemesPayload>(cacheKey);
    if (cached) {
      return Response.json({ ...cached, source: "cache" as const });
    }
  }

  const payload = await generatePopularThemes();
  if (payload.source === "ai" || payload.source === "fallback") {
    // Cache AI and fallback so we don't hammer providers / rebuild constantly
    setCached(
      cacheKey,
      payload,
      payload.source === "ai" ? THEMES_CACHE_TTL_MS : THEMES_CACHE_TTL_MS / 2,
    );
  }
  return Response.json(payload);
}
