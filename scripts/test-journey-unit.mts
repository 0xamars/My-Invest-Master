/**
 * Journey rails: Money Profile, Learn/Do tabs, derived working flags, soft locks.
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
  LEARN_CATALOG,
  LEARN_DISCLAIMER,
  LESSON_IDS,
  isLessonId,
  lessonsForPillar,
} from "../src/lib/journey/lessons.ts";
import {
  INVEST_DO_SKIP_WARNING,
  confirmBudgetElsewhere,
  confirmOptionsUse,
  investDoIsLocked,
  optionsIsGated,
} from "../src/lib/journey/locks.ts";
import {
  computeTrack,
  defaultMoneyProfileDraft,
  effectiveKnowledge,
  finalizeMoneyProfile,
  isLessonComplete,
  markLessonComplete,
  normalizeMoneyProfile,
} from "../src/lib/journey/profile.ts";
import { tickerStartsCollapsed } from "../src/lib/journey/density.ts";
import {
  ADD_HOLDING_FIELD_HELP,
  applyBudgetFirstRunKit,
  applyFirstBookIfMissing,
  FIRST_BOOK_FREEDOM_LINE,
  firstBookWizardCopy,
  firstRunKitEnvelopeNames,
  shouldOfferBudgetFirstRunKit,
  shouldOfferFirstBookWizard,
  SHOW_THE_DETAILS_LABEL,
  STARTER_ENVELOPE_NAMES,
  STARTER_SPENDING_ACCOUNT_NAME,
} from "../src/lib/journey/first-run.ts";
import { journeyStations, primaryNextAction } from "../src/lib/journey/stations.ts";
import {
  defaultPillarTab,
  learnIsCollapsed,
  pillarTabHref,
  resolvePillarTab,
} from "../src/lib/journey/tabs.ts";
import {
  deriveWorkingFlags,
  leftoverAssignedFromBudgetPlans,
  monthClosedFromBudgetPlans,
} from "../src/lib/journey/working.ts";
import { bookPresenceFromPortfolio } from "../src/lib/retirement/freedom-path.ts";
import { createEmptyBudgetPlan } from "../src/types/budget.ts";
import type { BudgetPlan, BudgetTransaction } from "../src/types/budget.ts";
import type { MoneyProfile } from "../src/types/money-profile.ts";
import type { PortfolioHolding } from "../src/types/portfolio.ts";
import { createEmptyPortfolio } from "../src/types/portfolio.ts";
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
  Object.keys(draft.completedLessons).length === 0,
  "completed lessons start empty",
);

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
  flags: {
    toolsOnly: true,
    budgetElsewhere: false,
    investNoHoldingsYet: false,
    optionsConfirmed: false,
  },
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
    {
      budgetElsewhere: false,
      investNoHoldingsYet: false,
      toolsOnly: false,
      optionsConfirmed: false,
    },
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
assert(stations[0].learnHref === "/budget?tab=learn", "Budget Learn deep-links");
assert(stations[0].doHref === "/budget?tab=do", "Budget Do deep-links");
assert(stations[1].learnHref === "/invest?tab=learn", "Invest Learn deep-links");
assert(stations[1].doHref === "/invest?tab=do", "Invest Do deep-links");
assert(stations[2].learnHref === "/freedom?tab=learn", "Freedom Learn deep-links");
assert(stations[2].doHref === "/freedom?tab=do", "Freedom Do deep-links");
assert(stations[0].href === "/budget", "Budget station hub is /budget");
assert(stations[1].href === "/invest", "Invest station hub is /invest");
assert(stations[2].href === "/freedom", "Freedom station hub is /freedom");
assert(stations[0].status === "in_progress", "Fast Track Budget is in progress");
assert(stations[1].status === "in_progress", "Fast Track Invest is in progress");
assert(
  stations.every((station) => station.status !== "locked"),
  "Fast Track does not soft-lock stations",
);

const beginnerStations = journeyStations(draft);
assert(beginnerStations[0].status === "learn", "Beginner Budget starts as Learn");
assert(
  beginnerStations[1].status === "locked",
  "Beginner Invest Do is locked until Budget is working",
);
assert(
  beginnerStations[2].status === "learn",
  "Freedom Learn stays available on Beginner Track",
);

const nextBeginner = primaryNextAction(draft);
assert(nextBeginner.href === "/budget?tab=learn", "Beginner next action is Budget Learn");
assert(nextBeginner.label === "Learn Budget", "Beginner next label is Learn Budget");

const workingBudget: MoneyProfile = {
  ...finalized,
  working: { budget: true, invest: false, freedom: false },
};
assert(
  primaryNextAction(workingBudget).href === "/invest?tab=do",
  "after Budget working, next is Invest Do",
);

assert(defaultPillarTab(draft, "budget") === "learn", "beginner Budget defaults to Learn");
assert(defaultPillarTab(finalized, "budget") === "do", "Fast Track defaults to Do");
assert(defaultPillarTab(tools, "invest") === "do", "toolsOnly defaults to Do");
assert(learnIsCollapsed(finalized) === true, "Fast Track collapses Learn");
assert(learnIsCollapsed(tools) === true, "toolsOnly collapses Learn");
assert(learnIsCollapsed(draft) === false, "Beginner Track shows full Learn");
assert(
  defaultPillarTab(beginner, "invest") === "learn",
  "Beginner Track + beginner Invest knowledge defaults to Learn",
);
assert(
  defaultPillarTab(beginner, "freedom") === "do",
  "Beginner Track + confident Freedom knowledge defaults to Do",
);
assert(resolvePillarTab("learn", finalized, "budget") === "learn", "explicit Learn wins");
assert(resolvePillarTab("do", draft, "budget") === "do", "explicit Do wins on beginner");
assert(pillarTabHref("invest", "learn", "invest-the-book") === "/invest?tab=learn&lesson=invest-the-book", "lesson query");

const marked = markLessonComplete(draft, "budget-envelopes-leftover");
assert(isLessonComplete(marked, "budget-envelopes-leftover"), "complete flag persists");
assert(
  !isLessonComplete(marked, "budget-close-month"),
  "other lessons stay incomplete",
);
const normalizedFlags = normalizeMoneyProfile({
  ...marked,
  completedLessons: {
    "budget-envelopes-leftover": true,
    "not-a-lesson": true,
    "budget-close-month": false,
  },
});
assert(
  normalizedFlags.completedLessons["budget-envelopes-leftover"] === true,
  "known complete flag is kept",
);
assert(
  normalizedFlags.completedLessons["not-a-lesson"] === undefined,
  "unknown lesson ids are dropped",
);
assert(
  normalizedFlags.completedLessons["budget-close-month"] === undefined,
  "false complete flags are dropped",
);
assert(
  markLessonComplete(draft, "not-a-lesson").completedLessons["not-a-lesson"] ===
    undefined,
  "marking an unknown id is a no-op",
);

assert(lessonsForPillar("budget").length === 5, "Budget has five lessons");
assert(lessonsForPillar("invest").length === 6, "Invest has six lessons");
assert(lessonsForPillar("freedom").length === 4, "Freedom has four lessons");
assert(LESSON_IDS.length === 15, "fifteen V1 lessons");
assert(isLessonId("invest-company-page"), "company page lesson exists");
assert(
  LEARN_DISCLAIMER ===
    "Educational. Not financial advice. You can lose money.",
  "learn footer is the required disclaimer",
);

const forbidden = [
  "YNAB",
  "Retire",
  "Simply Wall St",
  "Snowflake",
  "Apple",
  "iOS",
];
const catalogText = JSON.stringify(LEARN_CATALOG);
for (const word of forbidden) {
  assert(!catalogText.includes(word), `lesson copy does not name ${word}`);
}

const requiredCtaPrefix = ["/budget?tab=do", "/invest?tab=do", "/freedom?tab=do"];
for (const pillar of ["budget", "invest", "freedom"] as const) {
  for (const lesson of lessonsForPillar(pillar)) {
    assert(lesson.paragraphs.length === 3, `${lesson.id} has three paragraphs`);
    assert(lesson.cta.href.length > 0, `${lesson.id} has a CTA route`);
    assert(
      requiredCtaPrefix.some((prefix) => lesson.cta.href.startsWith(prefix.split("?")[0])),
      `${lesson.id} CTA stays on a real pillar route`,
    );
    assert(!lesson.cta.href.includes("/analysis/"), `${lesson.id} does not fake a ticker`);
    assert((lesson.checks?.length ?? 0) <= 2, `${lesson.id} has at most two checks`);
  }
}

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

function inflowOn(plan: BudgetPlan, amount: number): BudgetTransaction {
  return {
    id: "in-1",
    date: "2026-08-02",
    payee: "Pay",
    accountId: plan.accounts[0]!.id,
    categoryId: null,
    amount,
    type: "inflow",
    cleared: "cleared",
  };
}

const emptyDerived = deriveWorkingFlags({
  flags: draft.flags,
  completedLessons: {},
  budgetPlans: [],
  primaryBook: null,
  freedomPlans: [],
});
assert(emptyDerived.budget === false, "no leftover is not budget.working");
assert(emptyDerived.invest === false, "no book is not invest.working");
assert(emptyDerived.freedom === false, "no saved plan is not freedom.working");

const leftoverPlan = createEmptyBudgetPlan("Leftover");
leftoverPlan.transactions = [inflowOn(leftoverPlan, 750)];
assert(
  leftoverAssignedFromBudgetPlans([leftoverPlan]),
  "present leftover counts as leftover assigned",
);
assert(
  deriveWorkingFlags({
    flags: draft.flags,
    completedLessons: {},
    budgetPlans: [leftoverPlan],
    primaryBook: null,
    freedomPlans: [],
  }).budget,
  "real leftover sets budget.working",
);

const assignedPlan = createEmptyBudgetPlan("Assigned");
assignedPlan.monthBudgets = {
  "2026-08": { assignments: { [assignedPlan.categories[0]!.id]: 120 } },
};
assert(
  leftoverAssignedFromBudgetPlans([assignedPlan]),
  "envelope assignment counts as leftover assigned",
);
assert(
  leftoverPresenceFromBudgetPlan(assignedPlan).status !== "present",
  "assignment-only plan does not invent leftover",
);

const closedPlan = createEmptyBudgetPlan("Closed");
closedPlan.closedThrough = "2026-07";
assert(monthClosedFromBudgetPlans([closedPlan]), "closedThrough is a closed month");
assert(
  deriveWorkingFlags({
    flags: draft.flags,
    completedLessons: {},
    budgetPlans: [closedPlan],
    primaryBook: null,
    freedomPlans: [],
  }).budget,
  "month close sets budget.working",
);

const closedAtPlan = createEmptyBudgetPlan("Closed at");
closedAtPlan.monthBudgets = {
  "2026-07": { assignments: {}, closedAt: "2026-08-01T00:00:00.000Z" },
};
assert(
  monthClosedFromBudgetPlans([closedAtPlan]),
  "closedAt marks a month closed",
);

assert(
  deriveWorkingFlags({
    flags: { ...draft.flags, budgetElsewhere: true },
    completedLessons: {},
    budgetPlans: [],
    primaryBook: null,
    freedomPlans: [],
  }).budget,
  "budgetElsewhere sets budget.working",
);

assert(
  deriveWorkingFlags({
    flags: draft.flags,
    completedLessons: {},
    budgetPlans: [],
    primaryBook: { id: "p1", name: "Book", holdings: bookOnly.holdings },
    freedomPlans: [],
  }).invest,
  "a holding on the primary book sets invest.working",
);

const emptyQtyHolding: PortfolioHolding = {
  ...bookOnly.holdings[0]!,
  quantity: 0,
};
assert(
  deriveWorkingFlags({
    flags: draft.flags,
    completedLessons: {},
    budgetPlans: [],
    primaryBook: { id: "p1", name: "Book", holdings: [emptyQtyHolding] },
    freedomPlans: [],
  }).invest === false,
  "zero-quantity holding is not a book",
);

assert(
  deriveWorkingFlags({
    flags: { ...draft.flags, investNoHoldingsYet: true },
    completedLessons: {},
    budgetPlans: [],
    primaryBook: null,
    freedomPlans: [],
  }).invest === false,
  "investNoHoldingsYet alone is not invest.working",
);
assert(
  deriveWorkingFlags({
    flags: { ...draft.flags, investNoHoldingsYet: true },
    completedLessons: { "invest-the-book": true },
    budgetPlans: [],
    primaryBook: null,
    freedomPlans: [],
  }).invest,
  "investNoHoldingsYet plus invest-the-book is invest.working",
);

assert(
  deriveWorkingFlags({
    flags: draft.flags,
    completedLessons: {},
    budgetPlans: [],
    primaryBook: null,
    freedomPlans: [createEmptyPlan("Freedom")],
  }).freedom,
  "a saved Freedom plan sets freedom.working",
);

assert(investDoIsLocked({ profile: draft, hasBook: false }), "Beginner Invest Do is locked");
assert(
  !investDoIsLocked({ profile: finalized, hasBook: false }),
  "Fast Track Invest Do is unlocked",
);
assert(
  !investDoIsLocked({ profile: tools, hasBook: false }),
  "toolsOnly Invest Do is unlocked",
);
assert(
  !investDoIsLocked({
    profile: { ...draft, working: { ...draft.working, budget: true } },
    hasBook: false,
  }),
  "budget.working unlocks Invest Do",
);
assert(
  !investDoIsLocked({ profile: draft, hasBook: true }),
  "an existing book unlocks Invest Do",
);
assert(
  !investDoIsLocked({
    profile: confirmBudgetElsewhere(draft),
    hasBook: false,
  }),
  "I budget elsewhere unlocks Invest Do",
);
assert(
  confirmBudgetElsewhere(draft).flags.budgetElsewhere,
  "skip sets budgetElsewhere",
);
assert(
  INVEST_DO_SKIP_WARNING.includes("will not stay in sync"),
  "skip warning says leftover and the book will not stay in sync",
);

const skipped = confirmBudgetElsewhere(draft);
const skippedWorking = deriveWorkingFlags({
  flags: skipped.flags,
  completedLessons: {},
  budgetPlans: [],
  primaryBook: null,
  freedomPlans: [],
});
assert(skippedWorking.budget, "skip derives budget.working");
assert(
  journeyStations({ ...skipped, working: skippedWorking })[1].status !== "locked",
  "after skip, Invest station is not locked",
);
assert(
  journeyStations(draft, { hasBook: true })[1].status !== "locked",
  "existing book is not hidden behind Locked",
);
assert(
  journeyStations(markLessonComplete(draft, "budget-envelopes-leftover"))[0]
    .status === "in_progress",
  "a completed Budget lesson is In progress",
);

const emptyKitOffer = applyBudgetFirstRunKit([]);
assert(shouldOfferBudgetFirstRunKit([]), "empty Budget offers the first-run kit");
assert(emptyKitOffer.length === 1, "empty Budget creates one starter plan");
assert(
  firstRunKitEnvelopeNames(emptyKitOffer[0]!).join(",") ===
    STARTER_ENVELOPE_NAMES.join(","),
  "empty Budget offers Housing, Food, Transport, Debt, Fun, Buffer",
);
assert(
  emptyKitOffer[0]!.accounts.length === 1 &&
    emptyKitOffer[0]!.accounts[0]!.name === STARTER_SPENDING_ACCOUNT_NAME,
  "empty Budget offers one Spending account",
);
assert(
  emptyKitOffer[0]!.transactions.length === 0 &&
    Object.keys(emptyKitOffer[0]!.monthBudgets).length === 0 &&
    emptyKitOffer[0]!.closedThrough === null,
  "starter kit does not invent leftover or a closed month",
);

const existingPlan = createEmptyBudgetPlan("Mine");
existingPlan.transactions = [inflowOn(existingPlan, 400)];
const keptPlans = applyBudgetFirstRunKit([existingPlan]);
assert(!shouldOfferBudgetFirstRunKit(keptPlans), "existing plan is not offered a kit");
assert(keptPlans.length === 1, "existing plan is not wiped");
assert(keptPlans[0]!.id === existingPlan.id, "existing plan id stays");
assert(
  keptPlans[0]!.transactions[0]!.amount === 400,
  "existing leftover stays honest",
);
assert(
  firstRunKitEnvelopeNames(keptPlans[0]!).join(",") !==
    STARTER_ENVELOPE_NAMES.join(","),
  "existing plan envelopes are left alone",
);

assert(
  firstBookWizardCopy().freedomLine === FIRST_BOOK_FREEDOM_LINE,
  "first book copy includes the Freedom line",
);
assert(
  FIRST_BOOK_FREEDOM_LINE === "this is the book Freedom will use.",
  "Freedom line is the required sentence",
);
assert(shouldOfferFirstBookWizard([]), "no book offers the first-book wizard");
const existingBook = createEmptyPortfolio("Keep me", { isPrimary: true });
existingBook.id = "p-keep";
existingBook.holdings = bookOnly.holdings;
const keptBooks = applyFirstBookIfMissing(
  [existingBook],
  "Should not replace",
);
assert(!shouldOfferFirstBookWizard(keptBooks), "existing book is not hidden");
assert(keptBooks.length === 1, "existing book is not deleted");
assert(keptBooks[0]!.id === "p-keep", "existing book id stays");
assert(keptBooks[0]!.name === "Keep me", "existing book name stays");
assert(keptBooks[0]!.holdings.length === 1, "existing holdings stay");
const newBook = applyFirstBookIfMissing([], "My book");
assert(newBook.length === 1, "missing book creates one empty book");
assert(newBook[0]!.holdings.length === 0, "first book does not invent holdings");
assert(newBook[0]!.name === "My book", "first book uses the given name");

assert(tickerStartsCollapsed(draft), "beginner ticker starts collapsed");
assert(
  SHOW_THE_DETAILS_LABEL === "Show the details",
  "ticker details control is labeled Show the details",
);
assert(!tickerStartsCollapsed(finalized), "Fast Track ticker stays full density");
assert(!tickerStartsCollapsed(tools), "toolsOnly ticker stays full density");
assert(!tickerStartsCollapsed(null), "no profile does not collapse the ticker");
assert(
  tickerStartsCollapsed(beginner),
  "Beginner Track + beginner invest knowledge collapses the ticker",
);

assert(optionsIsGated(draft), "beginner Options is gated");
assert(!optionsIsGated(finalized), "Fast Track skips the Options gate");
assert(!optionsIsGated(tools), "toolsOnly skips the Options gate");
assert(!optionsIsGated(null), "no profile does not gate Options");
assert(
  confirmOptionsUse(draft).flags.optionsConfirmed,
  "confirm sets optionsConfirmed",
);
assert(
  !optionsIsGated(confirmOptionsUse(draft)),
  "after confirm, beginner Options is open",
);
assert(
  ADD_HOLDING_FIELD_HELP.quantity.includes("Do not invent"),
  "beginner add-holding explains quantity honestly",
);

const sliceDCopy = [
  FIRST_BOOK_FREEDOM_LINE,
  SHOW_THE_DETAILS_LABEL,
  STARTER_ENVELOPE_NAMES.join(" "),
  STARTER_SPENDING_ACCOUNT_NAME,
  ADD_HOLDING_FIELD_HELP.type,
  ADD_HOLDING_FIELD_HELP.asset,
  ADD_HOLDING_FIELD_HELP.sector,
  ADD_HOLDING_FIELD_HELP.quantity,
  ADD_HOLDING_FIELD_HELP.price,
  ADD_HOLDING_FIELD_HELP.date,
].join(" ");
for (const word of forbidden) {
  assert(!sliceDCopy.includes(word), `Slice D copy does not name ${word}`);
}

assert(investDoIsLocked({ profile: draft, hasBook: false }), "Slice C lock stays: Beginner Invest Do is locked");
assert(
  !investDoIsLocked({ profile: finalized, hasBook: false }),
  "Slice C lock stays: Fast Track Invest Do is unlocked",
);
assert(
  !investDoIsLocked({ profile: tools, hasBook: false }),
  "Slice C lock stays: toolsOnly Invest Do is unlocked",
);

if (failed > 0) {
  console.error(`\n${failed} journey assertion(s) failed`);
  process.exit(1);
}
console.log("\nall journey assertions passed");
