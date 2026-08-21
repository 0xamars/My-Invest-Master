"use client";

import { RetireField, RetirePanel } from "@/components/retirement/retire-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyRetirementPlanPatch } from "@/lib/retirement/normalize";
import { createEmptySpouse, type RetirementPlan } from "@/types/retirement";

export function RetirementPlanLevers({
  plan,
  onChange,
}: {
  plan: RetirementPlan;
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
              value={plan.currentAge}
              onChange={(event) =>
                patch({ currentAge: Number(event.target.value) || plan.currentAge })
              }
              className="tabular-nums"
            />
          </RetireField>
          <RetireField
            id="retirement-age"
            label="Target age"
            hint={`Year ${plan.retirementYear}`}
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
                onClick={() => patch({ currency: code })}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {plan.spouse ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <RetireField label="Spouse name">
              <Input
                value={plan.spouse.name}
                onChange={(event) =>
                  patch({
                    spouse: { ...plan.spouse!, name: event.target.value },
                  })
                }
              />
            </RetireField>
            <RetireField label="Spouse age">
              <Input
                type="number"
                min="18"
                max="100"
                value={plan.spouse.currentAge}
                onChange={(event) =>
                  patch({
                    spouse: {
                      ...plan.spouse!,
                      currentAge: Number(event.target.value) || plan.spouse!.currentAge,
                    },
                  })
                }
                className="tabular-nums"
              />
            </RetireField>
            <RetireField label="Spouse target age">
              <Input
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
        ) : null}
      </RetirePanel>

      <RetirePanel className="space-y-4 px-5 py-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Spend, save, withdraw</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Target nest egg is spending ÷ withdrawal rate. Savings are added
            each year until the target age.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <RetireField id="spend" label="Annual lifestyle spending">
            <Input
              id="spend"
              type="number"
              min="0"
              step="1000"
              value={plan.annualLifestyleSpending}
              onChange={(event) =>
                patch({
                  annualLifestyleSpending: Number(event.target.value) || 0,
                })
              }
              className="tabular-nums"
            />
          </RetireField>
          <RetireField id="save" label="Annual savings until target age">
            <Input
              id="save"
              type="number"
              min="0"
              step="500"
              value={plan.annualContribution}
              onChange={(event) =>
                patch({
                  annualContribution: Number(event.target.value) || 0,
                })
              }
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
