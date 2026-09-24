"use client";

import { CurrencyAmountInput } from "@/components/retirement/currency-amount-input";
import { RetireField, RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RETIRE_ENGINE_ASSUMPTIONS } from "@/lib/retirement/assumptions";
import { applyRetirementPlanPatch } from "@/lib/retirement/normalize";
import type { FxRates } from "@/types/currency";
import { createEmptySpouse, type RetirementPlan } from "@/types/retirement";

export function RetirementPlanLevers({
  plan,
  rates,
  onChange,
}: {
  plan: RetirementPlan;
  rates: FxRates;
  onChange: (plan: RetirementPlan) => void;
}) {
  function patch(next: Partial<RetirementPlan>) {
    onChange(applyRetirementPlanPatch(plan, next));
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <RetirePanel className="space-y-4 px-5 py-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Person and horizon</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Canada-first defaults: longevity 90. Target year stays in sync
            with your ages.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <RetireField id="current-age" label="Current age">
            <Input
              id="current-age"
              type="number"
              min="18"
              max="100"
              value={plan.currentAge ?? ""}
              placeholder="Age"
              onChange={(event) => {
                const raw = event.target.value;
                if (raw.trim() === "") {
                  patch({ currentAge: null });
                  return;
                }
                const next = Number(raw);
                if (!Number.isFinite(next)) return;
                patch({ currentAge: next });
              }}
              className="tabular-nums"
            />
          </RetireField>
          <RetireField
            id="retirement-age"
            label="Target age"
            hint={
              plan.retirementYear != null
                ? `Year ${plan.retirementYear}`
                : "Enter your age"
            }
          >
            <Input
              id="retirement-age"
              type="number"
              min="30"
              max="100"
              value={plan.retirementAge}
              onChange={(event) =>
                patch({
                  retirementAge: Number(event.target.value) || plan.retirementAge,
                })
              }
              className="tabular-nums"
            />
          </RetireField>
          <RetireField id="plan-end-age" label="Plan end age">
            <Input
              id="plan-end-age"
              type="number"
              min={plan.retirementAge}
              max="120"
              value={plan.planEndAge}
              onChange={(event) =>
                patch({ planEndAge: Number(event.target.value) || plan.planEndAge })
              }
              className="tabular-nums"
            />
          </RetireField>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={plan.spouse ? "default" : "outline"}
            aria-pressed={Boolean(plan.spouse)}
            onClick={() =>
              patch({ spouse: plan.spouse ? null : createEmptySpouse() })
            }
          >
            {plan.spouse ? "Spouse included" : "Add spouse"}
          </Button>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(["CAD", "USD"] as const).map((code) => (
              <button
                key={code}
                type="button"
                className={
                  plan.currency === code
                    ? "bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    : "px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                }
                aria-pressed={plan.currency === code}
                aria-label={`Plan currency ${code}`}
                onClick={() => patch({ currency: code })}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {plan.spouse ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <RetireField id="spouse-name" label="Spouse name">
                <Input
                  id="spouse-name"
                  value={plan.spouse.name}
                  onChange={(event) =>
                    patch({
                      spouse: { ...plan.spouse!, name: event.target.value },
                    })
                  }
                />
              </RetireField>
              <RetireField id="spouse-age" label="Spouse age">
                <Input
                  id="spouse-age"
                  type="number"
                  min="18"
                  max="100"
                  value={plan.spouse.currentAge ?? ""}
                  placeholder="Age"
                  onChange={(event) => {
                    const raw = event.target.value;
                    const currentAge = raw.trim() === "" ? null : Number(raw);
                    if (currentAge != null && !Number.isFinite(currentAge)) return;
                    patch({
                      spouse: {
                        ...plan.spouse!,
                        currentAge,
                      },
                    });
                  }}
                  className="tabular-nums"
                />
              </RetireField>
              <RetireField id="spouse-target-age" label="Spouse target age">
                <Input
                  id="spouse-target-age"
                  type="number"
                  min="30"
                  max="100"
                  value={plan.spouse.retirementAge}
                  onChange={(event) =>
                    patch({
                      spouse: {
                        ...plan.spouse!,
                        retirementAge:
                          Number(event.target.value) || plan.spouse!.retirementAge,
                      },
                    })
                  }
                  className="tabular-nums"
                />
              </RetireField>
            </div>
            <RetireField
              id="pension-split"
              label="Pension income split %"
              hint="Share of pension income assigned to the other person, up to 50%. CPP and OAS stay with the person who receives them. The household total does not change. Withdrawal order also uses this percent for RRIF income when the owner is 65 or older."
            >
              <Input
                id="pension-split"
                type="number"
                min="0"
                max="50"
                step="1"
                value={plan.pensionSplitPercent}
                onChange={(event) =>
                  patch({
                    pensionSplitPercent: Number(event.target.value) || 0,
                  })
                }
                className="tabular-nums"
              />
            </RetireField>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Each person retires at their own target age. Household spending
              starts when the first person reaches theirs. Add each CPP, OAS,
              and pension as its own income row.
            </p>
            <details className="text-xs leading-relaxed text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Assumptions for two people
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {RETIRE_ENGINE_ASSUMPTIONS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          </div>
        ) : null}
      </RetirePanel>

      <RetirePanel className="space-y-4 px-5 py-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Spend, save, withdraw</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Target nest egg is spending ÷ withdrawal rate. Plan savings are
            added each year until your target age. An account can also carry
            its own annual contribution.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <RetireField
            id="spend"
            label={`Annual lifestyle spending (${plan.currency})`}
          >
            <CurrencyAmountInput
              id="spend"
              allowEmpty
              min="0"
              step="1000"
              placeholder="Yearly spending"
              usdValue={plan.annualLifestyleSpending}
              currency={plan.currency}
              rates={rates}
              onUsdChange={(annualLifestyleSpending) =>
                patch({ annualLifestyleSpending })
              }
              aria-label={`Annual lifestyle spending in ${plan.currency}`}
              className="tabular-nums"
            />
          </RetireField>
          <RetireField
            id="save"
            label={`Annual savings until target age (${plan.currency})`}
          >
            <CurrencyAmountInput
              id="save"
              min="0"
              step="500"
              usdValue={plan.annualContribution}
              currency={plan.currency}
              rates={rates}
              onUsdChange={(annualContribution) => {
                if (annualContribution == null) return;
                patch({ annualContribution });
              }}
              aria-label={`Annual savings in ${plan.currency}`}
              className="tabular-nums"
            />
          </RetireField>
          <RetireField id="swr" label="Withdrawal rate %">
            <Input
              id="swr"
              type="number"
              min="0.1"
              step="0.1"
              value={plan.withdrawalRate}
              onChange={(event) =>
                patch({
                  withdrawalRate: Number(event.target.value) || plan.withdrawalRate,
                })
              }
              className="tabular-nums"
            />
          </RetireField>
          <RetireField id="inflation" label="Inflation %">
            <Input
              id="inflation"
              type="number"
              step="0.1"
              value={plan.inflationRate}
              onChange={(event) =>
                patch({ inflationRate: Number(event.target.value) || 0 })
              }
              className="tabular-nums"
            />
          </RetireField>
        </div>
      </RetirePanel>
    </div>
  );
}
