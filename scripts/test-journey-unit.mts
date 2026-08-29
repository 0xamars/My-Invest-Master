/**
 * Slice A journey rails: Money Profile normalize/track, stations, honest Freedom date.
 *   npx tsx --tsconfig tsconfig.json scripts/test-journey-unit.mts
 */
import { leftoverPresenceFromBudgetPlan } from "../src/lib/invest/leftover.ts";
import {
  allChecksAnswered,
  knowledgeFromChecks,
} from "../src/lib/journey/checks.ts";
import {
  FREEDOM_DATE_NEEDS_INPUTS,
  journeyFreedomDate,
} from "../src/lib/journey/freedom-date.ts";
import { profileSummaryLine } from "../src/lib/journey/labels.ts";
import {
  computeTrack,
  defaultMoneyProfileDraft,
  effectiveKnowledge,
  finalizeMoneyProfile,
  normalizeMoneyProfile,
} from "../src/lib/journey/profile.ts";
import { journeyStations, primaryNextAction } from "../src/lib/journey/stations.ts";
import { bookPresenceFromPortfolio } from "../src/lib/retirement/freedom-path.ts";
import { createEmptyBudgetPlan } from "../src/types/budget.ts";
import type { MoneyProfile } from "../src/types/money-profile.ts";
import type { PortfolioHolding } from "../src/types/portfolio.ts";
import { createEmptyPlan } from "../src/types/retirement.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const draft = defaultMoneyProfileDraft();
assert(draft.country === "CA", "default country is CA");
assert(draft.currency === "CAD", "default currency is CAD");
assert(draft.incomeAmount === null, "income is not invented");
assert(draft.working.budget === false, "working budget starts false");
assert(draft.track === "beginner", "default track is beginner");

assert(
  knowledgeFromChecks("budget", {}) === "beginner",
  "unanswered checks are beginner",
);
assert(
  knowledgeFromChecks("budget", {
    budget_leftover: "unassigned",
  }) === "intermediate",
  "one correct budget check is intermediate",
);
assert(
  knowledgeFromChecks("budget", {
    budget_leftover: "unassigned",
    budget_month_close: "carry",
  }) === "confident",
  "two correct budget checks are confident",
);

const conservative = effectiveKnowledge(
  { budget: "confident", invest: "confident", freedom: "confident" },
  {
    budget_leftover: "spend",
    budget_month_close: "zero",
    invest_avg_cost: "today",
    invest_book: "rating",
    freedom_date_source: "guess",
    freedom_missing: "invent",
  },
);
assert(conservative.budget === "beginner", "self-confident loses to failed checks");
assert(conservative.invest === "beginner", "invest effective is conservative");
assert(conservative.freedom === "beginner", "freedom effective is conservative");

const confidentChecks = {
  budget_leftover: "unassigned",
  budget_month_close: "carry",
  invest_avg_cost: "paid",
  invest_book: "qty",
  freedom_date_source: "leftover_book",
  freedom_missing: "unknown",
};
assert(allChecksAnswered(confidentChecks), "six answers complete the checks");

const fast = normalizeMoneyProfile({
  country: "CA",
  currency: "CAD",
  knowledge: { budget: "confident", invest: "comfortable", freedom: "confident" },
  knowledgeChecks: confidentChecks,
  riskBand: "growth",
  primaryGoal: "start_investing",
});
assert(fast.knowledge.invest === "confident", "comfortable aliases confident");
assert(fast.track === "fast", "all-confident effective knowledge is Fast Track");

const tools = normalizeMoneyProfile({
  ...fast,
  flags: { toolsOnly: true, budgetElsewhere: false, investNoHoldingsYet: false },
});
assert(tools.track === "tools", "toolsOnly wins the track");

const beginner = normalizeMoneyProfile({
  knowledge: { budget: "intermediate", invest: "beginner", freedom: "confident" },
  knowledgeChecks: confidentChecks,
});
assert(
  beginner.track === "beginner",
  "Beginner Track when any effective pillar is not confident",
);

assert(
  computeTrack(
    { budget: "confident", invest: "confident", freedom: "confident" },
    { budgetElsewhere: false, investNoHoldingsYet: false, toolsOnly: false },
  ) === "fast",
  "computeTrack fast",
);

const finalized = finalizeMoneyProfile({
  ...draft,
  knowledge: { budget: "confident", invest: "confident", freedom: "confident" },
  knowledgeChecks: confidentChecks,
  primaryGoal: "cushion",
  riskBand: "preserve",
});
assert(finalized.track === "fast", "finalize recomputes Fast Track");
assert(finalized.working.invest === false, "working is not inferred from leftover");

const stations = journeyStations(finalized);
assert(stations.length === 3, "three stations");
assert(
  stations.every((station) => station.learnHref === station.doHref),
  "Slice A Learn and Do share the existing tool href",
);
assert(stations[0].href === "/budget", "Budget station links to /budget");
assert(stations[1].href === "/invest", "Invest station links to /invest");
assert(stations[2].href === "/freedom", "Freedom station links to /freedom");
assert(
  stations.every((station) => station.status !== "locked"),
  "Slice A does not soft-lock stations",
);

const nextBeginner = primaryNextAction(draft);
assert(nextBeginner.href === "/budget", "Beginner next action is Budget");
assert(nextBeginner.label === "Learn Budget", "Beginner next label is Learn Budget");

const workingBudget: MoneyProfile = {
  ...finalized,
  working: { budget: true, invest: false, freedom: false },
};
assert(
  primaryNextAction(workingBudget).href === "/invest",
  "after Budget working, next is Invest",
);

assert(
  profileSummaryLine(finalized) === "Build a cushion · Fast Track · Preserve",
  "one-line profile uses goal, track, and risk",
);

const emptyBudget = leftoverPresenceFromBudgetPlan(null);
const emptyBook = bookPresenceFromPortfolio(null);
assert(
  journeyFreedomDate({ leftover: emptyBudget, book: emptyBook }).label ===
    FREEDOM_DATE_NEEDS_INPUTS,
  "missing leftover and book is labeled, not dated",
);

const plan = createEmptyBudgetPlan("Budget");
const noneLeftover = leftoverPresenceFromBudgetPlan(plan);
assert(noneLeftover.status === "none" || noneLeftover.status === "missing-budget", "empty budget has no leftover");
const bookOnly = bookPresenceFromPortfolio({
  id: "p1",
  name: "Book",
  holdings: [
    {
      id: "h1",
      symbol: "VOO",
      name: "Vanguard S&P 500",
      type: "stock",
      sector: "Index",
      category: "Index",
      subCategory: "US",
      costPrice: 400,
      quantity: 10,
      addedAt: "2026-01-01T00:00:00.000Z",
      transactions: [],
    } satisfies PortfolioHolding,
  ],
});
assert(bookOnly.status === "present", "holdings count as a book");
assert(
  journeyFreedomDate({ leftover: noneLeftover, book: bookOnly }).label ===
    FREEDOM_DATE_NEEDS_INPUTS,
  "book without leftover is not a date",
);

const leftoverPresent = {
  status: "present" as const,
  amount: 2_000,
  currency: "CAD" as const,
  budgetPlanId: plan.id,
};
assert(
  journeyFreedomDate({ leftover: leftoverPresent, book: emptyBook }).label ===
    FREEDOM_DATE_NEEDS_INPUTS,
  "leftover without a book is not a date",
);

const assumptions = createEmptyPlan("Freedom");
assumptions.annualLifestyleSpending = 40_000;
assumptions.annualContribution = 99_999;
const dated = journeyFreedomDate({
  leftover: leftoverPresent,
  book: bookOnly,
  assumptions,
  currentYear: 2026,
});
assert(dated.status === "ready", "leftover + book may show a date");
assert(
  assumptions.annualContribution === 99_999,
  "widget does not mutate the stored plan contribution",
);

const inventedIncome = normalizeMoneyProfile({
  incomeAmount: "skip",
  age: "unknown",
});
assert(inventedIncome.incomeAmount === null, "junk income stays unknown");
assert(inventedIncome.age === null, "junk age stays unknown");

if (failed > 0) {
  console.error(`\n${failed} journey assertion(s) failed`);
  process.exit(1);
}
console.log("\nall journey assertions passed");
