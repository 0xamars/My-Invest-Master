"use client";

import { useMemo, useState } from "react";
import { RetirementDisclaimer } from "@/components/retirement/retirement-disclaimer";
import { RetirementPlanProjectionsTable } from "@/components/retirement/retirement-plan-projections-table";
import { RetireField, RetirePanel } from "@/components/retirement/retire-ui";
import { Input } from "@/components/ui/input";
import { formatProjectionMoney } from "@/lib/retirement/format";
import { runRetirementMonteCarlo } from "@/lib/retirement/monte-carlo";
import {
  computeRetirementProjections,
  findDepletionAge,
} from "@/lib/retirement/projections";
import type { DisplayCurrency, FxRates } from "@/types/currency";
import {
  personLabel,
  type RetirementPersonId,
  type RetirementPlan,
} from "@/types/retirement";

const SURVIVOR_ASSUMPTIONS = [
  "Death is applied at the start of the year that person reaches the age you enter. The planner does not choose that age.",
  "Their accounts move to the survivor before growth that year. An RRSP or RRIF stays that kind of account. Later RRIF minimums use the survivor's age.",
  "CPP and OAS stop. A pension or other income continues only at the survivor percent on that row, which starts at zero.",
  "Household spending stays the same number. This view does not model a CPP survivor pension or the OAS allowance.",
  "The range below uses the same 750-path Monte Carlo as the household plan, with this death applied on every path.",
];

export function RetirementSurvivorPanel({
  plan,
  currency,
  rates,
  currentYear,
}: {
  plan: RetirementPlan;
  currency: DisplayCurrency;
  rates: FxRates;
  currentYear: number;
}) {
  const [deceased, setDeceased] = useState<RetirementPersonId>("person1");
  const [deathAgeText, setDeathAgeText] = useState("");

  const you = personLabel(plan, "person1");
  const spouse = personLabel(plan, "person2");
  const deathAge = Number(deathAgeText);
  const ageReady = deathAgeText.trim() !== "" && Number.isFinite(deathAge);

  const survivor = useMemo(
    () =>
      ageReady
        ? computeRetirementProjections(plan, {
            currentYear,
            survivor: { deceased, deathAge },
          })
        : [],
    [plan, currentYear, deceased, deathAge, ageReady],
  );

  const baseEnd = useMemo(() => {
    if (!ageReady) return null;
    const base = computeRetirementProjections(plan, { currentYear });
    return base[base.length - 1]?.closingBalance ?? null;
  }, [plan, currentYear, ageReady]);

  const monteCarlo = useMemo(
    () =>
      ageReady && plan.assets.length > 0
        ? runRetirementMonteCarlo(plan, {
            currentYear,
            paths: 750,
            seed: 17,
            survivor: { deceased, deathAge },
          })
        : null,
    [plan, currentYear, deceased, deathAge, ageReady],
  );

  const endBalance = survivor[survivor.length - 1]?.closingBalance ?? null;
  const depletionAge = findDepletionAge(survivor);
  const who = deceased === "person1" ? you : spouse;

  return (
    <RetirePanel className="space-y-4 px-5 py-5">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Survivor view</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          See the household if one person dies at an age you choose. Both
          people stay in the main projection until you fill this in.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <RetireField id="survivor-who" label="Who dies">
          <select
            id="survivor-who"
            className="h-10 w-full rounded-[var(--radius)] border border-border bg-muted px-3 text-sm"
            value={deceased}
            onChange={(event) =>
              setDeceased(event.target.value === "person2" ? "person2" : "person1")
            }
          >
            <option value="person1">{you}</option>
            <option value="person2">{spouse}</option>
          </select>
        </RetireField>
        <RetireField
          id="survivor-age"
          label={`Age ${who} dies`}
          hint="Leave blank to keep the both-alive projection."
        >
          <Input
            id="survivor-age"
            type="number"
            min="0"
            max="120"
            inputMode="numeric"
            placeholder="Age"
            value={deathAgeText}
            onChange={(event) => setDeathAgeText(event.target.value)}
            className="tabular-nums"
          />
        </RetireField>
      </div>

      {ageReady ? (
        <div className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Balance at plan end"
              value={
                endBalance == null
                  ? "—"
                  : formatProjectionMoney(endBalance, currency, rates)
              }
            />
            <Stat
              label="If both live"
              value={
                baseEnd == null
                  ? "—"
                  : formatProjectionMoney(baseEnd, currency, rates)
              }
            />
            <Stat
              label="Portfolio lasts until"
              value={depletionAge == null ? "Past plan end" : `Age ${depletionAge}`}
            />
          </dl>
          {monteCarlo ? (
            <p className="text-sm text-muted-foreground">
              {Math.round(monteCarlo.successRate * 100)}% of 750 paths still
              have a balance at the end of this survivor path.
            </p>
          ) : null}
          <RetirementPlanProjectionsTable
            projections={survivor}
            assets={plan.assets}
            currency={currency}
            rates={rates}
            retirementYear={plan.retirementYear}
            personLabels={{ person1: you, person2: spouse }}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter an age to run this view. No death age is assumed.
        </p>
      )}

      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
        {SURVIVOR_ASSUMPTIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <RetirementDisclaimer />
    </RetirePanel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
