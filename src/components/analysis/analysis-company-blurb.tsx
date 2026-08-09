"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { truncateProfileDescription } from "@/lib/analysis/company-blurb";

export function AnalysisCompanyBlurb({
  symbol,
  name,
  sector,
  industry,
  country,
  description,
}: {
  symbol: string;
  name: string | null;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  description?: string | null;
}) {
  const fallback = truncateProfileDescription(description);
  const [text, setText] = useState<string | null>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const nextFallback = truncateProfileDescription(description);
    setText(nextFallback);
    setLoading(true);
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/analysis/company-blurb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            name,
            sector: sector ?? null,
            industry: industry ?? null,
            country: country ?? null,
            description: description ?? null,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { blurb?: string | null };
        const next = typeof data.blurb === "string" ? data.blurb.trim() : "";
        if (!cancelled && next) setText(next);
      } catch {
        /* keep fallback */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, name, sector, industry, country, description]);

  return (
    <Card className="surface-card h-full shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">About</CardTitle>
      </CardHeader>
      <CardContent>
        {text ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {loading
              ? "Loading company description…"
              : "No company description available."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
