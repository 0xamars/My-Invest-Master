"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { EarlyOppSearch } from "@/components/invest/early-opp/early-opp-search";
import { EarlyOppStatusChip } from "@/components/invest/early-opp/early-opp-status";
import { InvestToolsNav } from "@/components/layout/invest-tools-nav";
import { RetirePageHeader, RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { INVEST_EARLY_OPP_PATH } from "@/lib/analysis/early-opp/paths";
import type { EarlyOppPayload, EarlyOppStatus, EarlyOppStepResult } from "@/lib/analysis/early-opp";
import { formatTickerPrice } from "@/lib/ticker/format";
import { profitLossClass } from "@/lib/portfolio/format";
import { cn } from "@/lib/utils";

function CountTile({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: EarlyOppStatus;
}) {
  return (
    <div className="budget-metric rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
      <p className="budget-metric-label">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="budget-metric-value">{value}</p>
        <EarlyOppStatusChip status={status} />
      </div>
    </div>
  );
}

function StepCard({ step }: { step: EarlyOppStepResult }) {
  return (
    <article
      id={`early-opp-${step.number}`}
      className="rounded-xl border border-border/70 bg-muted/10 p-4 sm:p-5"
      data-early-opp-step={step.id}
      data-early-opp-status={step.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Step {String(step.number).padStart(2, "0")}
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">{step.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{step.question}</p>
        </div>
        <EarlyOppStatusChip status={step.status} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground/90">{step.explanation}</p>
      {step.numbers.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {step.numbers.map((item) => (
            <div key={item.label} className="budget-metric">
              <dt className="budget-metric-label">{item.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{item.display}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">{step.hint}</p>
    </article>
  );
}

export function EarlyOppScreen({ symbol }: { symbol: string }) {
  const [payload, setPayload] = useState<EarlyOppPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/invest/early-opp?symbol=${encodeURIComponent(symbol)}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to load the 16-step framework");
      }
      setPayload((await response.json()) as EarlyOppPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the 16-step framework");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !payload) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Reading {symbol}…
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="space-y-4">
        <InvestToolsNav />
        <RetirePageHeader title="16-step framework" description="A decision aid — not a buy ticket." />
        <RetirePanel className="p-6">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-4" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </RetirePanel>
      </div>
    );
  }

  if (!payload) return null;

  const change = payload.quote.changePercent;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <InvestToolsNav />
      <RetirePageHeader
        title="16-step framework"
        description="Strengths versus gaps on loaded data. You decide buy, sell, or hold."
        action={
          <Link
            href={INVEST_EARLY_OPP_PATH}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            New ticker
          </Link>
        }
      />

      <RetirePanel className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-border/60 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <EarlyOppSearch
              currentSymbol={payload.quote.symbol}
              size="sm"
              placeholder="Switch ticker…"
              className="max-w-sm flex-1"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {payload.quote.name || payload.quote.symbol}
              </p>
              <p className="text-xs text-muted-foreground">{payload.quote.symbol}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-semibold tabular-nums">
              {formatTickerPrice(payload.quote.price)}
            </span>
            {change != null ? (
              <span className={cn("tabular-nums", profitLossClass(change))}>
                {change >= 0 ? "+" : ""}
                {change.toFixed(2)}%
              </span>
            ) : null}
            <Link
              href={payload.meta.analysisHref}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Analysis
            </Link>
            <Link
              href={payload.meta.assessHref}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Assess
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CountTile label="Pass" value={payload.counts.pass} status="pass" />
          <CountTile label="Soft" value={payload.counts.soft} status="soft" />
          <CountTile label="Fail" value={payload.counts.fail} status="fail" />
          <CountTile label="Unknown" value={payload.counts.unknown} status="unknown" />
        </div>

        {!payload.meta.ai.configured ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Qualitative steps (theme, stack, moat, why it is moving) stay on loaded
            statements until an AI key is configured. Scores never invent Financial
            Modeling Prep figures.
          </p>
        ) : null}
        {payload.meta.packageDegraded && payload.meta.confidenceNote ? (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            {payload.meta.confidenceNote}
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {payload.steps.map((step) => (
            <StepCard key={step.id} step={step} />
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">{payload.disclaimer}</p>
      </RetirePanel>
    </div>
  );
}
