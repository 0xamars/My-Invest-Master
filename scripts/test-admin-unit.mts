/**
 * Admin role, feature-flag overrides, sample data, and privacy of the health view.
 *   npx tsx --tsconfig tsconfig.json scripts/test-admin-unit.mts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describeFlagsForAdmin, flagAuditAction } from "../src/lib/admin/flag-state.ts";
import {
  buildSampleDataset,
  resetSkipsSecretsAndAccountSettings,
  SAMPLE_BUDGET_NAME,
  SAMPLE_FUND_NAME,
  SAMPLE_PORTFOLIO_NAME,
  SAMPLE_RETIRE_NAME,
  SAMPLE_SHARES_SYMBOL,
  SAMPLE_UNIT,
  sampleBudgetLeftoverIsZero,
  TEST_ACCOUNT_RESET_TABLES,
} from "../src/lib/admin/demo-data.ts";
import {
  APP_ERRORS_NOTE,
  buildUserHealth,
  healthExposesMoneyOrSecrets,
  isUserHealth,
} from "../src/lib/admin/health.ts";
import {
  INITIAL_ADMIN_EMAIL,
  isListedAdminEmail,
  normalizeAdminEmail,
} from "../src/lib/admin/admin-email.ts";
import {
  canSeedOwnAccount,
  isTestAccountEmail,
  normalizeLookupEmail,
} from "../src/lib/admin/test-account.ts";
import {
  ADMIN_LOOKUP_ERROR_CACHE_MS,
  adminLookupErrorIsCached,
} from "../src/lib/admin/is-admin.ts";
import {
  FEATURE_FLAG_IDS,
  envEnablesFlag,
  resolveFeatureFlag,
} from "../src/lib/flags/catalog.ts";
import { parseEnvFlag } from "../src/lib/flags/env.ts";
import {
  fmpDisplayAllowsEmail,
  parseFmpDisplayAllowlist,
} from "../src/lib/market-data/display-gate.ts";
import { isProtectedRoute } from "../src/lib/security/protected-routes.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(parseEnvFlag(undefined) === false, "unset flag is off");
assert(parseEnvFlag("0") === false, "0 is off");
assert(parseEnvFlag("false") === false, "false is off");
assert(parseEnvFlag("1") === true, "1 is on");
assert(parseEnvFlag(" TRUE ") === true, "true is on");

assert(
  envEnablesFlag("bank_connect", {}) === false,
  "bank connection stays off when the env var is unset",
);
assert(
  envEnablesFlag("retire_no_login_planner", {
    NEXT_PUBLIC_RETIRE_NO_LOGIN_PLANNER_ENABLED: "1",
  }) === true,
  "the public Retire planner flag reads its env var",
);
assert(
  resolveFeatureFlag("bank_connect", false, null) === false,
  "no override keeps an off server setting",
);
assert(
  resolveFeatureFlag("bank_connect", false, true) === true,
  "an override can turn bank connection on for one account",
);
assert(
  resolveFeatureFlag("bank_connect", true, false) === false,
  "an override can turn a flag off for one account",
);
assert(
  resolveFeatureFlag("retire_no_login_planner", false, null) === false,
  "the public Retire planner stays off by default",
);
assert(
  resolveFeatureFlag("fmp_display", true, null) === false,
  "market data has no extra grant without an override",
);
assert(
  resolveFeatureFlag("fmp_display", true, true) === true,
  "a market-data override grants that account",
);

const flags = describeFlagsForAdmin(new Map([["bank_connect", true]]), {
  NEXT_PUBLIC_BANK_CONNECT_ENABLED: "0",
  FMP_DISPLAY_GATE_ENABLED: "1",
});
const bank = flags.find((flag) => flag.id === "bank_connect");
const market = flags.find((flag) => flag.id === "fmp_display");
assert(bank?.effective === true, "admin state shows bank connection on for that person");
assert(bank?.serverOn === false, "admin state still shows the server setting as off");
assert(market?.effective === null, "market data access is not a simple on/off result");
assert(market?.serverOn === true, "market data server state is the gate");
assert(
  flagAuditAction("bank_connect", null) === "set_flag:bank_connect:default",
  "clearing an override is its own audit action",
);
assert(
  flagAuditAction("fmp_display", false) === "set_flag:fmp_display:off",
  "turning a flag off is named in the audit action",
);

assert(isTestAccountEmail("founder+test1@example.com"), "plus test1 is a test account");
assert(isTestAccountEmail(" Founder+Test@Example.com "), "plus test ignores case");
assert(isTestAccountEmail("a+test12@example.com"), "plus test and digits is a test account");
assert(!isTestAccountEmail("founder+testing@example.com"), "testing is not the test tag");
assert(!isTestAccountEmail("founder+test1a@example.com"), "letters after the tag do not count");
assert(!isTestAccountEmail("founder@example.com"), "a normal address is not a test account");
assert(!isTestAccountEmail("test1@example.com"), "the tag must be a plus-address");
assert(!isTestAccountEmail("+test1@example.com"), "the local part needs a name before the tag");
assert(
  canSeedOwnAccount("admin@investsalsa.com"),
  "the dedicated admin login can seed its own account",
);
assert(
  canSeedOwnAccount(" Admin@InvestSalsa.com "),
  "the dedicated admin login match ignores case",
);
assert(canSeedOwnAccount("founder+test1@example.com"), "a plus-address can seed its own account");
assert(
  canSeedOwnAccount("admin+test@investsalsa.com"),
  "a plus-address on the admin domain can seed itself",
);
assert(!canSeedOwnAccount("founder@example.com"), "a normal address cannot seed itself");
assert(normalizeLookupEmail(" A@Example.com ") === "a@example.com", "lookup email is trimmed");
assert(normalizeLookupEmail("not-an-email") === null, "lookup rejects a fragment");

assert(INITIAL_ADMIN_EMAIL === "admin@investsalsa.com", "the seeded admin email is the dedicated login");
assert(
  normalizeAdminEmail(" Admin@InvestSalsa.com ") === INITIAL_ADMIN_EMAIL,
  "admin email compare ignores case and surrounding space",
);
assert(
  normalizeAdminEmail("admin+test@investsalsa.com") !== INITIAL_ADMIN_EMAIL,
  "a plus-address is not the admin login",
);
const allow = new Set([INITIAL_ADMIN_EMAIL]);
assert(
  isListedAdminEmail(
    { email: INITIAL_ADMIN_EMAIL, email_confirmed_at: "2026-10-01T00:00:00.000Z" },
    allow,
  ) === true,
  "a confirmed allowlisted email is admin",
);
assert(
  isListedAdminEmail({ email: INITIAL_ADMIN_EMAIL, email_confirmed_at: null }, allow) ===
    false,
  "an unconfirmed allowlisted email is not admin",
);
assert(
  isListedAdminEmail(
    { email: "other@example.com", email_confirmed_at: "2026-10-01T00:00:00.000Z" },
    allow,
  ) === false,
  "a confirmed email that is not listed is not admin",
);
assert(
  isListedAdminEmail(
    {
      email: "admin@investsalsa.com.example",
      email_confirmed_at: "2026-10-01T00:00:00.000Z",
    },
    allow,
  ) === false,
  "a lookalike domain is not the admin login",
);

const allowlist = parseFmpDisplayAllowlist("allowed@example.com");
assert(
  fmpDisplayAllowsEmail("tester@example.com", {
    enabled: true,
    allowlist,
    emailConfirmed: true,
    userOverride: true,
  }) === true,
  "a confirmed tester override can see market data while the gate is on",
);
assert(
  fmpDisplayAllowsEmail("allowed@example.com", {
    enabled: true,
    allowlist,
    emailConfirmed: true,
    userOverride: false,
  }) === false,
  "override off beats the email list",
);

const now = new Date("2026-03-15T15:00:00.000Z");
const sample = buildSampleDataset({ now, portfolioIsPrimary: true });
assert(sample.budget.name === SAMPLE_BUDGET_NAME, "sample budget is labelled");
assert(sample.portfolio.name === SAMPLE_PORTFOLIO_NAME, "sample portfolio is labelled");
assert(sample.retire.name === SAMPLE_RETIRE_NAME, "sample Retire plan is labelled");
assert(sample.budget.accounts.length === 2, "sample budget has two accounts");
assert(sample.budget.transactions.length === 2, "sample budget has two transactions");
assert(
  sample.budget.transactions.every((tx) => tx.amount === SAMPLE_UNIT && tx.memo === "Sample"),
  "sample transactions are placeholders",
);
assert(sample.portfolio.holdings.length === 1, "sample portfolio has one holding");
assert(sample.portfolio.holdings[0]?.symbol === SAMPLE_SHARES_SYMBOL, "sample symbol is SAMPLE");
assert(sample.portfolio.holdings[0]?.type === "custom", "sample holding is not a live ticker");
assert(sample.portfolio.holdings[0]?.costPrice === SAMPLE_UNIT, "sample cost is a placeholder");
assert(sample.retire.currentAge === null, "sample Retire plan does not invent an age");
assert(sample.retire.retirementYear === null, "sample Retire plan does not invent a retire date");
assert(
  sample.retire.annualLifestyleSpending === null,
  "sample Retire plan does not invent spending",
);
assert(sample.retire.incomeStreams.length === 0, "sample Retire plan does not invent income");
assert(sample.retire.assets[0]?.name === SAMPLE_FUND_NAME, "sample fund is labelled");
assert(sample.retire.assets[0]?.annualContribution === 0, "sample fund adds no contribution");
assert(sample.retire.assets[0]?.expectedCagr === 0, "sample fund does not invent growth");
assert(sampleBudgetLeftoverIsZero(sample), "sample month leftover is zero");
assert(sample.portfolio.isPrimary === true, "an empty test account can show the sample book");
const text = JSON.stringify(sample);
assert(!text.includes("access_token"), "sample data has no bank token");
assert(!/ynab|simply wall st/i.test(text), "sample data does not name other products");
assert(
  resetSkipsSecretsAndAccountSettings(),
  "reset does not touch plan tier, bank links, or admin tables",
);
assert(
  !(TEST_ACCOUNT_RESET_TABLES as readonly string[]).includes("user_preferences"),
  "reset leaves preferences in place",
);

const health = buildUserHealth({
  userId: "11111111-1111-4111-8111-111111111111",
  email: "founder+test1@example.com",
  createdAt: "2026-09-24T00:00:00.000Z",
  testAccount: true,
  row: {
    budget_plans: 1,
    budget_accounts: 2,
    budget_transactions: 2,
    portfolios: 1,
    retire_plans: 1,
    plan: "free",
    last_activity: "2026-09-24T01:00:00.000Z",
  },
});
assert(isUserHealth(health), "health view has only the support fields");
assert(health.transactions === 2, "health transaction field is a count");
assert(health.errorsNote === APP_ERRORS_NOTE, "health does not invent an error log");
assert(health.plan === "free", "missing premium stays Free");
assert(!healthExposesMoneyOrSecrets(health), "health has no money or secret fields");
assert(
  buildUserHealth({
    userId: "11111111-1111-4111-8111-111111111111",
    email: "a@example.com",
    createdAt: null,
    testAccount: false,
    row: {},
  }).plan === "free",
  "an account with no plan row is Free",
);

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(ts|tsx|md|sql)$/.test(entry)) files.push(path);
  }
  return files;
}

const migration = readFileSync("supabase/migrations/019_admin_and_flags.sql", "utf8");
for (const table of ["app_admins", "feature_flag_overrides", "admin_audit_log"]) {
  assert(
    migration.includes(`alter table public.${table} enable row level security`),
    `${table} enables row level security`,
  );
  assert(
    migration.includes(`revoke all on table public.${table} from public, anon, authenticated`),
    `${table} is revoked from browser roles`,
  );
}
assert(!/create policy/i.test(migration), "admin tables have no browser policies");
for (const flag of FEATURE_FLAG_IDS) {
  assert(migration.includes(`'${flag}'`), `migration allows the ${flag} flag`);
}
assert(
  migration.includes("revoke all on function public.admin_lookup_user_by_email(text)"),
  "email lookup is not executable by the browser",
);
assert(
  migration.includes("revoke all on function public.admin_user_health(uuid)"),
  "health counts are not executable by the browser",
);
assert(
  !migration.includes("access_token"),
  "the admin migration does not read bank tokens",
);
for (const fn of ["admin_lookup_user_by_email", "admin_user_health"]) {
  const match = migration.match(
    new RegExp(`function public\\.${fn}[\\s\\S]*?set search_path = ([^\\n]+)`),
  );
  assert(match, `${fn} sets search_path`);
  const parts = match[1].replace(/;/g, "").split(",").map((part) => part.trim());
  assert(parts.at(-1) === "pg_temp", `${fn} search_path ends with pg_temp`);
}

const emailMigration = readFileSync("supabase/migrations/020_admin_email.sql", "utf8");
assert(
  emailMigration.includes("alter table public.app_admin_emails enable row level security"),
  "admin emails enable row level security",
);
assert(
  emailMigration.includes(
    "revoke all on table public.app_admin_emails from public, anon, authenticated",
  ),
  "admin emails are revoked from browser roles",
);
assert(!/create policy/i.test(emailMigration), "admin emails have no browser policy");
assert(
  emailMigration.includes(`'${INITIAL_ADMIN_EMAIL}'`),
  "migration seeds the dedicated admin email",
);
assert(
  emailMigration.includes("from auth.users"),
  "migration links an existing auth user by email",
);
assert(
  emailMigration.includes("email_confirmed_at is not null"),
  "migration does not grant an unconfirmed account",
);

assert(ADMIN_LOOKUP_ERROR_CACHE_MS === 60_000, "a failed admin lookup stays quiet for 60 seconds");
assert(adminLookupErrorIsCached(1_000, 500), "a future expiry means the failure is cached");
assert(!adminLookupErrorIsCached(1_000, 1_000), "an expiry at the current time is not cached");
assert(!adminLookupErrorIsCached(undefined, 1), "a missing expiry is not cached");

const adminCheck = readFileSync("src/lib/admin/is-admin.ts", "utf8");
assert(adminCheck.includes('from("app_admins")'), "admin check reads user ids");
assert(adminCheck.includes('from("app_admin_emails")'), "admin check reads the email allowlist");
assert(
  adminCheck.includes("grantErrorUntil"),
  "the sign-in path caches a failed admin lookup",
);
const isAdminFn = adminCheck.slice(
  adminCheck.indexOf("export async function isAdmin"),
  adminCheck.indexOf("export async function grantListedAdminOnSignIn"),
);
assert(!isAdminFn.includes("grantErrorUntil"), "isAdmin does not use the failure cache");
assert(
  readFileSync("src/lib/supabase/middleware.ts", "utf8").includes("grantListedAdminOnSignIn"),
  "sign-in grants a listed confirmed email",
);
assert(
  readFileSync("src/app/auth/callback/route.ts", "utf8").includes("grantListedAdminOnSignIn"),
  "the confirmation link grants a listed confirmed email",
);

const adminPage = readFileSync("src/app/admin/page.tsx", "utf8");
assert(adminPage.includes("notFound("), "non-admins get a 404");
assert(adminPage.includes("isAdmin("), "the page checks isAdmin");
assert(isProtectedRoute("/admin") === false, "/admin is a 404, not a sign-in wall");
assert(
  isProtectedRoute("/api/admin/lookup") === false,
  "the admin API is a 404, not a sign-in wall",
);

const plaidHttp = readFileSync("src/lib/plaid/http.ts", "utf8");
assert(
  plaidHttp.includes('isFeatureEnabled("bank_connect"'),
  "bank routes require the bank connection flag",
);
const itemRoute = readFileSync("src/app/api/plaid/item/route.ts", "utf8");
assert(
  itemRoute.includes("requireBankFlag: false"),
  "disconnect still runs when the bank flag is off",
);
const demoRoute = readFileSync("src/app/api/admin/demo/route.ts", "utf8");
assert(!demoRoute.includes("userId"), "the demo route ignores a user id from the body");
assert(demoRoute.includes("auth.user.id"), "the demo route uses the signed-in admin id");
assert(demoRoute.includes("canSeedOwnAccount"), "the demo route checks the signed-in email");
assert(
  demoRoute.includes('body.confirm !== "reset"'),
  "reset requires the confirm flag on the server",
);
const demoBody = demoRoute.slice(demoRoute.indexOf("export async function POST"));
assert(
  demoBody.indexOf("writeAdminAudit") < demoBody.indexOf("seedTestAccountDemo"),
  "sample data is audited before it is written",
);
const flagsRoute = readFileSync("src/app/api/admin/flags/route.ts", "utf8");
const flagsBody = flagsRoute.slice(flagsRoute.indexOf("export async function POST"));
assert(
  flagsBody.indexOf("writeAdminAudit") < flagsBody.indexOf("setFlagOverride"),
  "a flag change is audited before it is saved",
);
const consoleSource = readFileSync("src/components/admin/admin-console.tsx", "utf8");
assert(consoleSource.includes('confirm: "reset"'), "the console sends the reset confirmation");
const runDemo = consoleSource.slice(
  consoleSource.indexOf("async function runDemo"),
  consoleSource.indexOf("return ("),
);
assert(!runDemo.includes("userId"), "sample data is not sent for a looked-up account");
assert(
  consoleSource.includes("signedInCanSeed"),
  "sample data is offered only for the signed-in account",
);
const catalog = readFileSync("src/lib/flags/catalog.ts", "utf8");
assert(
  catalog.includes("supabase/migrations/019_admin_and_flags.sql"),
  "the flag catalog names the admin migration",
);
assert(
  readFileSync("src/app/api/plaid/webhook/route.ts", "utf8").includes("requirePlaidUser") ===
    false,
  "the bank webhook is not blocked by the account flag",
);

const accounts = readFileSync("src/components/budget/budget-accounts-content.tsx", "utf8");
const transactions = readFileSync(
  "src/components/budget/budget-transactions-content.tsx",
  "utf8",
);
assert(accounts.includes("BudgetBankLinkGate"), "Accounts uses the bank flag gate");
assert(transactions.includes("BudgetBankLinkGate"), "Transactions uses the bank flag gate");
assert(!accounts.includes("<BudgetBankLink "), "Accounts does not mount bank linking directly");

for (const file of walk("src")) {
  const source = readFileSync(file, "utf8");
  const client = source.includes('"use client"') || source.includes("'use client'");
  if (!client) continue;
  assert(!source.includes("app_admins"), `${file} must not read app_admins`);
  assert(!source.includes("app_admin_emails"), `${file} must not read admin emails`);
  assert(
    !source.includes("feature_flag_overrides"),
    `${file} must not read feature flag rows`,
  );
  assert(!source.includes("admin_audit_log"), `${file} must not read the audit log`);
  assert(!source.includes("SUPABASE_SERVICE_ROLE_KEY"), `${file} must not see the service key`);
}

const adminDoc = readFileSync("docs/admin.md", "utf8");
assert(adminDoc.includes("app_admins"), "admin doc explains how to add an admin");
assert(adminDoc.includes(INITIAL_ADMIN_EMAIL), "admin doc names the dedicated login");
assert(
  /not Amar's personal/i.test(adminDoc),
  "admin doc says the dedicated login is not a personal account",
);
assert(adminDoc.includes("name+test1@example.com"), "admin doc shows the test-account alias");
assert(/cannot see/i.test(adminDoc), "admin doc says what admins cannot see");
assert(!/ynab|simply wall st/i.test(adminDoc), "admin doc does not name other products");

const manual = readFileSync("docs/journey-manual-tests.md", "utf8");
assert(manual.includes("/admin"), "manual tests cover /admin");
assert(manual.includes("404"), "manual tests cover the 404");

console.log("admin unit tests passed");
