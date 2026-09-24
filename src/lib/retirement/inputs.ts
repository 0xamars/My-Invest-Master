import type { RetirementPlan, RetirementSpouse } from "@/types/retirement";

export type RetirementInputGap = "age" | "spending";

/** A person's age counts only after they enter a positive number. */
export function isEnteredAge(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Missing spending is null. Zero is an amount the person entered. */
export function isEnteredSpending(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function missingRetirementInputs(
  plan: Pick<RetirementPlan, "currentAge" | "annualLifestyleSpending" | "spouse">,
): RetirementInputGap[] {
  const missing: RetirementInputGap[] = [];
  const spouseAgeMissing =
    plan.spouse != null && !isEnteredAge(plan.spouse.currentAge);
  if (!isEnteredAge(plan.currentAge) || spouseAgeMissing) missing.push("age");
  if (!isEnteredSpending(plan.annualLifestyleSpending)) missing.push("spending");
  return missing;
}

export type ReadyRetirementSpouse = RetirementSpouse & { currentAge: number };

export type ReadyRetirementPlan = RetirementPlan & {
  currentAge: number;
  annualLifestyleSpending: number;
  retirementYear: number;
  spouse: ReadyRetirementSpouse | null;
};

/**
 * Projections and summaries need an entered age, entered spending, and a
 * target year derived from those ages. A missing spouse age blocks the plan.
 */
export function retirementPlanReady(
  plan: RetirementPlan,
): plan is ReadyRetirementPlan {
  if (missingRetirementInputs(plan).length > 0) return false;
  return typeof plan.retirementYear === "number" && Number.isFinite(plan.retirementYear);
}

export function retirementInputPrompt(missing: RetirementInputGap[]): {
  title: string;
  description: string;
} | null {
  if (missing.length === 0) return null;
  if (missing.includes("age") && missing.includes("spending")) {
    return {
      title: "Enter your age to see your plan",
      description:
        "Enter your yearly spending in retirement. Retire will not fill either one in.",
    };
  }
  if (missing.includes("age")) {
    return {
      title: "Enter your age to see your plan",
      description: "Each person needs an age. Retire will not choose one.",
    };
  }
  return {
    title: "Enter your yearly spending in retirement",
    description:
      "Spending is the amount the plan draws. Retire will not assume one.",
  };
}
