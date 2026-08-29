"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChoiceGroup } from "@/components/journey/choice-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { KNOWLEDGE_CHECKS } from "@/lib/journey/checks";
import {
  COUNTRY_CURRENCY,
  MONEY_PROFILE_COUNTRIES,
  defaultMoneyProfileDraft,
  finalizeMoneyProfile,
  goalStepIsComplete,
  knowledgeStepIsComplete,
  situationIsComplete,
} from "@/lib/journey/profile";
import { APP_HOME_PATH } from "@/lib/routes";
import { SETTINGS_PATH } from "@/lib/chrome/nav";
import {
  FEATURED_DISPLAY_CURRENCIES,
  listDisplayCurrencies,
  type DisplayCurrency,
} from "@/types/currency";
import {
  INCOME_CADENCES,
  JOURNEY_PILLARS,
  KNOWLEDGE_LEVELS,
  PRIMARY_GOALS,
  RISK_BANDS,
  WORK_STATUSES,
  type IncomeCadence,
  type JourneyPillar,
  type KnowledgeLevel,
  type MoneyProfile,
  type PrimaryGoal,
  type RiskBand,
  type WorkStatus,
} from "@/types/money-profile";
import { KNOWLEDGE_LABELS, WORK_STATUS_LABELS } from "@/lib/journey/labels";

const CADENCE_LABELS: Record<IncomeCadence, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice a month",
  monthly: "Monthly",
  yearly: "Yearly",
};

const GOAL_OPTIONS = [
  { value: "cashflow", label: "Steady cash flow" },
  { value: "cushion", label: "A cash cushion" },
  { value: "start_investing", label: "Start investing" },
  { value: "retire_year", label: "A year I can stop working" },
  { value: "unsure", label: "Not sure yet" },
] as const satisfies ReadonlyArray<{ value: PrimaryGoal; label: string }>;

const RISK_OPTIONS = [
  {
    value: "preserve",
    label: "Sell",
    description: "A −20% year: I would sell to stop the drop.",
  },
  {
    value: "balanced",
    label: "Hold",
    description: "A −20% year: I would hold and wait.",
  },
  {
    value: "growth",
    label: "Buy more",
    description: "A −20% year: I would buy more if I could.",
  },
] as const satisfies ReadonlyArray<{
  value: RiskBand;
  label: string;
  description: string;
}>;

const PILLAR_LABEL: Record<JourneyPillar, string> = {
  budget: "Budget",
  invest: "Invest",
  freedom: "Freedom",
};

function currenciesForSelect(): DisplayCurrency[] {
  const featured = new Set<DisplayCurrency>(FEATURED_DISPLAY_CURRENCIES);
  const rest = listDisplayCurrencies()
    .map((item) => item.code)
    .filter((code) => !featured.has(code));
  const ordered: DisplayCurrency[] = [
    ...FEATURED_DISPLAY_CURRENCIES,
    ...rest,
  ];
  if (!ordered.includes("CAD")) ordered.unshift("CAD");
  return Array.from(new Set(ordered));
}

export function MoneyProfileWizard({
  mode = "onboarding",
}: {
  mode?: "onboarding" | "edit";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSettings =
    mode === "edit" || searchParams.get("from") === "settings";
  const { profile, saveProfile, isSaving } = useMoneyProfile();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<MoneyProfile>(
    () => profile ?? defaultMoneyProfileDraft(),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

  const currencies = useMemo(() => currenciesForSelect(), []);

  function patch(partial: Partial<MoneyProfile>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function setFlag(key: keyof MoneyProfile["flags"], value: boolean) {
    setDraft((current) => ({
      ...current,
      flags: { ...current.flags, [key]: value },
    }));
  }

  async function handleFinish() {
    setError(null);
    if (!goalStepIsComplete(draft)) {
      setError("Pick a goal and how you would treat a −20% year.");
      return;
    }
    try {
      await saveProfile(finalizeMoneyProfile(draft));
      router.push(fromSettings ? SETTINGS_PATH : APP_HOME_PATH);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save your Money Profile.",
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {step} of 3
        </p>
        <h1 className="page-title mt-1">Money Profile</h1>
        <p className="page-description">
          {step === 1
            ? "Country and currency first. Pay is optional — never required."
            : step === 2
              ? "Rate each pillar, then six short checks. We keep the more conservative of the two."
              : "A goal and a plain example of risk. No jargon."}
        </p>
      </div>

      {step === 1 ? (
        <div className="glass-card space-y-5 px-5 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-country">Country</Label>
              <Select
                value={draft.country}
                onValueChange={(value) => {
                  if (!value) return;
                  const country = String(value);
                  const nextCurrency =
                    COUNTRY_CURRENCY[country] ?? draft.currency;
                  patch({ country, currency: nextCurrency });
                }}
              >
                <SelectTrigger id="profile-country" className="w-full">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {MONEY_PROFILE_COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-currency">Currency</Label>
              <Select
                value={draft.currency}
                onValueChange={(value) => {
                  if (!value) return;
                  patch({ currency: value as DisplayCurrency });
                }}
              >
                <SelectTrigger id="profile-currency" className="w-full">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-age">Age (optional)</Label>
              <Input
                id="profile-age"
                type="number"
                min={0}
                max={120}
                inputMode="numeric"
                placeholder="Skip if you prefer"
                value={draft.age ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  patch({ age: raw === "" ? null : Number(raw) });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Work (optional)</Label>
              <Select
                value={draft.workStatus ?? undefined}
                onValueChange={(value) => {
                  patch({
                    workStatus:
                      value &&
                      (WORK_STATUSES as readonly string[]).includes(String(value))
                        ? (value as WorkStatus)
                        : null,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Skip if you prefer" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {WORK_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pay cadence (optional)</Label>
              <Select
                value={draft.incomeCadence ?? undefined}
                onValueChange={(value) => {
                  patch({
                    incomeCadence:
                      value &&
                      (INCOME_CADENCES as readonly string[]).includes(
                        String(value),
                      )
                        ? (value as IncomeCadence)
                        : null,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Skip — never required" />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CADENCES.map((cadence) => (
                    <SelectItem key={cadence} value={cadence}>
                      {CADENCE_LABELS[cadence]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-income">Pay amount (optional)</Label>
              <Input
                id="profile-income"
                type="number"
                min={0}
                inputMode="decimal"
                placeholder="Leave blank"
                value={draft.incomeAmount ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  patch({ incomeAmount: raw === "" ? null : Number(raw) });
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Optional flags</p>
            {(
              [
                ["budgetElsewhere", "I already budget somewhere else"],
                ["investNoHoldingsYet", "I do not have holdings yet"],
                ["toolsOnly", "I just want the tools"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground"
              >
                <input
                  type="checkbox"
                  checked={draft.flags[key]}
                  onChange={(event) => setFlag(key, event.target.checked)}
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="glass-card space-y-6 px-5 py-6">
          {JOURNEY_PILLARS.map((pillar) => (
            <ChoiceGroup
              key={pillar}
              legend={`${PILLAR_LABEL[pillar]} — how it feels today`}
              name={`knowledge-${pillar}`}
              value={draft.knowledge[pillar]}
              columns={3}
              options={KNOWLEDGE_LEVELS.map((level) => ({
                value: level,
                label: KNOWLEDGE_LABELS[level],
              }))}
              onChange={(level) =>
                patch({
                  knowledge: { ...draft.knowledge, [pillar]: level },
                })
              }
            />
          ))}

          <div className="space-y-4 border-t border-[color:var(--glass-hairline)] pt-4">
            <p className="text-sm font-medium">Six short checks</p>
            {KNOWLEDGE_CHECKS.map((check) => (
              <ChoiceGroup
                key={check.id}
                legend={check.prompt}
                name={check.id}
                value={draft.knowledgeChecks[check.id] ?? ""}
                options={check.options.map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                onChange={(answer) =>
                  patch({
                    knowledgeChecks: {
                      ...draft.knowledgeChecks,
                      [check.id]: answer,
                    },
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="glass-card space-y-6 px-5 py-6">
          <ChoiceGroup
            legend="Primary goal"
            name="primary-goal"
            value={draft.primaryGoal}
            options={GOAL_OPTIONS}
            onChange={(primaryGoal) => patch({ primaryGoal })}
          />
          <ChoiceGroup
            legend="A −20% year. What would you do?"
            name="risk-band"
            value={draft.riskBand}
            options={RISK_OPTIONS}
            onChange={(riskBand) => patch({ riskBand })}
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1}
          onClick={() => {
            setError(null);
            setStep((current) => Math.max(1, current - 1));
          }}
        >
          Back
        </Button>
        {step < 3 ? (
          <Button
            type="button"
            onClick={() => {
              setError(null);
              if (step === 1 && !situationIsComplete(draft)) {
                setError("Country and currency are required.");
                return;
              }
              if (step === 2 && !knowledgeStepIsComplete(draft)) {
                setError("Rate each pillar and answer the six checks.");
                return;
              }
              setStep((current) => current + 1);
            }}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={() => void handleFinish()} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            {fromSettings ? "Save profile" : "Save and open Journey"}
          </Button>
        )}
      </div>
      {fromSettings ? (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => router.push(SETTINGS_PATH)}
        >
          Cancel
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          You can edit this anytime in Settings. Budget, Invest, and Freedom stay
          open.
        </p>
      )}
    </div>
  );
}
