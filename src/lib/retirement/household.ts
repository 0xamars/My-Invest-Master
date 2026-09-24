import { inflateFromToday } from "@/lib/retirement/inflate";
import {
  DEFAULT_CURRENT_AGE,
  DEFAULT_PLAN_END_AGE,
  RRSP_CONVERSION_AGE,
  emptyPersonIncome,
  retirementYearFromAges,
  type PersonYearIncome,
  type RetirementIncomeKind,
  type RetirementIncomeStream,
  type RetirementPersonId,
  type RetirementPlan,
  type SurvivorScenario,
} from "@/types/retirement";

export interface ModeledPerson {
  id: RetirementPersonId;
  currentAge: number;
  retirementAge: number;
  retirementYear: number;
}

export function modeledPeople(
  plan: Pick<
    RetirementPlan,
    "currentAge" | "retirementAge" | "retirementYear" | "spouse"
  >,
  currentYear: number,
): ModeledPerson[] {
  const people: ModeledPerson[] = [
    {
      id: "person1",
      currentAge: plan.currentAge ?? DEFAULT_CURRENT_AGE,
      retirementAge: plan.retirementAge,
      retirementYear: plan.retirementYear,
    },
  ];

  if (plan.spouse) {
    people.push({
      id: "person2",
      currentAge: plan.spouse.currentAge,
      retirementAge: plan.spouse.retirementAge,
      retirementYear: retirementYearFromAges(
        plan.spouse.currentAge,
        plan.spouse.retirementAge,
        currentYear,
      ),
    });
  }

  return people;
}

export function personById(
  people: ModeledPerson[],
): Record<RetirementPersonId, ModeledPerson | null> {
  return {
    person1: people.find((person) => person.id === "person1") ?? null,
    person2: people.find((person) => person.id === "person2") ?? null,
  };
}

/** Age attained during the calendar year. */
export function ageInYear(person: ModeledPerson, year: number, currentYear: number): number {
  return person.currentAge + (year - currentYear);
}

/**
 * Horizon runs through each modeled person's plan-end age. With a spouse,
 * that is the later calendar year so the younger person is included.
 */
export function householdEndYear(
  plan: Pick<RetirementPlan, "currentAge" | "planEndAge" | "spouse">,
  currentYear: number,
): number {
  const endAge = plan.planEndAge ?? DEFAULT_PLAN_END_AGE;
  const person1End =
    currentYear + Math.max(0, endAge - (plan.currentAge ?? DEFAULT_CURRENT_AGE));
  if (!plan.spouse) return person1End;
  const spouseEnd =
    currentYear + Math.max(0, endAge - plan.spouse.currentAge);
  return Math.max(person1End, spouseEnd);
}

/** Lifestyle spending starts the first year either person has retired. */
export function householdDrawStartYear(
  people: ModeledPerson[],
): number {
  return Math.min(...people.map((person) => person.retirementYear));
}

export function activeSurvivor(
  plan: Pick<RetirementPlan, "spouse">,
  scenario: SurvivorScenario | null | undefined,
): SurvivorScenario | null {
  if (!plan.spouse || !scenario) return null;
  if (scenario.deceased !== "person1" && scenario.deceased !== "person2") {
    return null;
  }
  if (!Number.isFinite(scenario.deathAge)) return null;
  return scenario;
}

export function yearOfDeath(
  person: ModeledPerson,
  scenario: SurvivorScenario | null,
  currentYear: number,
): number | null {
  if (!scenario || scenario.deceased !== person.id) return null;
  return currentYear + (scenario.deathAge - person.currentAge);
}

export function isDeceasedInYear(
  person: ModeledPerson,
  year: number,
  scenario: SurvivorScenario | null,
  currentYear: number,
): boolean {
  const deathYear = yearOfDeath(person, scenario, currentYear);
  if (deathYear == null) return false;
  return year >= deathYear;
}

export function survivorOf(
  deceased: RetirementPersonId,
): RetirementPersonId {
  return deceased === "person1" ? "person2" : "person1";
}

function clampPercent(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

function streamAmount(
  stream: RetirementIncomeStream,
  inflationRatePercent: number,
  yearsFromNow: number,
): number {
  if (stream.annualAmount <= 0) return 0;
  return stream.colaWithInflation
    ? inflateFromToday(stream.annualAmount, inflationRatePercent, yearsFromNow)
    : stream.annualAmount;
}

function addKind(
  bucket: PersonYearIncome,
  kind: RetirementIncomeKind,
  amount: number,
): void {
  if (kind === "cpp") bucket.cpp += amount;
  else if (kind === "oas") bucket.oas += amount;
  else if (kind === "pension") bucket.pension += amount;
  else bucket.other += amount;
}

/**
 * Income by person. A stream pays when its owner is alive, has reached their
 * own target age, and has reached the stream start age. Nothing is invented:
 * a missing amount stays zero.
 *
 * After death, CPP and OAS stop. Pension and other income continue only at
 * survivorPercent (default 0), and only if the stream had already started.
 * The continued amount is attributed to the survivor.
 *
 * Pension split (0–50) reassigns pension streams while both people are alive.
 * It does not change the household total, and it does not apply to CPP, OAS,
 * or RRIF withdrawals.
 */
export function householdIncomeForYear(input: {
  streams: RetirementIncomeStream[];
  people: ModeledPerson[];
  year: number;
  currentYear: number;
  inflationRatePercent: number;
  pensionSplitPercent: number;
  scenario: SurvivorScenario | null;
}): {
  total: number;
  byPerson: Record<RetirementPersonId, PersonYearIncome>;
} {
  const byId = personById(input.people);
  const byPerson: Record<RetirementPersonId, PersonYearIncome> = {
    person1: emptyPersonIncome(),
    person2: emptyPersonIncome(),
  };
  const hasSpouse = byId.person2 != null;
  const yearsFromNow = input.year - input.currentYear;

  for (const stream of input.streams) {
    const ownerId: RetirementPersonId =
      hasSpouse && stream.owner === "person2" ? "person2" : "person1";
    const owner = byId[ownerId];
    if (!owner) continue;

    const dead = isDeceasedInYear(owner, input.year, input.scenario, input.currentYear);
    const amount = streamAmount(stream, input.inflationRatePercent, yearsFromNow);
    if (amount <= 0) continue;

    if (dead) {
      if (stream.kind === "cpp" || stream.kind === "oas") continue;
      const survivorPercent = clampPercent(stream.survivorPercent ?? 0, 100);
      if (survivorPercent <= 0 || !input.scenario) continue;
      if (input.scenario.deathAge < owner.retirementAge) continue;
      if (input.scenario.deathAge < stream.startAge) continue;
      const survivorId = survivorOf(ownerId);
      if (!byId[survivorId]) continue;
      addKind(byPerson[survivorId], stream.kind, amount * (survivorPercent / 100));
      continue;
    }

    const age = ageInYear(owner, input.year, input.currentYear);
    if (input.year < owner.retirementYear || age < stream.startAge) continue;
    addKind(byPerson[ownerId], stream.kind, amount);
  }

  const bothAlive =
    byId.person1 != null &&
    byId.person2 != null &&
    !isDeceasedInYear(byId.person1, input.year, input.scenario, input.currentYear) &&
    !isDeceasedInYear(byId.person2, input.year, input.scenario, input.currentYear);

  const split = bothAlive ? clampPercent(input.pensionSplitPercent, 50) / 100 : 0;
  const pension1 = byPerson.person1.pension;
  const pension2 = byPerson.person2.pension;
  byPerson.person1.pensionAfterSplit = pension1 - pension1 * split + pension2 * split;
  byPerson.person2.pensionAfterSplit = pension2 - pension2 * split + pension1 * split;

  const total =
    personIncomeTotal(byPerson.person1) + personIncomeTotal(byPerson.person2);

  return { total, byPerson };
}

function personIncomeTotal(income: PersonYearIncome): number {
  return income.cpp + income.oas + income.pension + income.other;
}

export function rrifProjectionNote(accountIsRrsp: boolean, ownerAge: number): string | null {
  if (!accountIsRrsp) return null;
  const attained = Math.floor(ownerAge);
  if (attained > RRSP_CONVERSION_AGE) return "Projected as a RRIF";
  if (attained === RRSP_CONVERSION_AGE) return "Converts to a RRIF at year-end";
  return null;
}
