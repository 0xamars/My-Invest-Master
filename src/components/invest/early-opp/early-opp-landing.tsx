"use client";

import { EARLY_OPP_STEPS } from "@/lib/analysis/early-opp/steps";
import { EARLY_OPP_DISCLAIMER } from "@/lib/analysis/early-opp/format";
import { EarlyOppSearch } from "@/components/invest/early-opp/early-opp-search";
import { InvestToolsNav } from "@/components/layout/invest-tools-nav";
import { RetireEmptyState, RetirePageHeader, RetirePanel } from "@/components/retirement/retire-ui";

export function EarlyOppLanding() {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <InvestToolsNav />
      <RetirePageHeader
        title="16-step framework"
        description="A decision aid for catching a spend wave early — theme, financials, moat, then timing. You decide buy, sell, or hold."
      />
      <RetirePanel className="p-6">
        <div className="space-y-6">
          <RetireEmptyState
            title="Pick a public equity"
            description="Search a name or ticker. All 16 steps render from loaded Financial Modeling Prep figures plus an optional qualitative read. Missing numbers stay unknown."
            actions={
              <div className="w-full max-w-md">
                <EarlyOppSearch />
              </div>
            }
          />
          <ol className="grid gap-2 sm:grid-cols-2">
            {EARLY_OPP_STEPS.map((step) => (
              <li
                key={step.id}
                className="flex gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5"
              >
                <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {String(step.number).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{step.title}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {step.question}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-center text-xs text-muted-foreground">{EARLY_OPP_DISCLAIMER}</p>
        </div>
      </RetirePanel>
    </div>
  );
}
