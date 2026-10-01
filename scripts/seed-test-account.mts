/**
 * Add or wipe sample data for one test account.
 * The email must be a plus-address such as founder+test1@example.com.
 *
 *   TEST_ACCOUNT_EMAIL=founder+test1@example.com npx tsx --tsconfig tsconfig.json scripts/seed-test-account.mts
 *   TEST_ACCOUNT_EMAIL=founder+test1@example.com npx tsx --tsconfig tsconfig.json scripts/seed-test-account.mts --reset
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Does not print plan contents.
 */
import { isTestAccountEmail } from "../src/lib/admin/test-account.ts";
import {
  AdminServiceError,
  lookupAccountByEmail,
  resetTestAccountData,
  seedTestAccountDemo,
} from "../src/lib/admin/service.ts";

const email = process.env.TEST_ACCOUNT_EMAIL?.trim() ?? "";
const reset = process.argv.includes("--reset");

if (!email) {
  console.error(
    "Set TEST_ACCOUNT_EMAIL to a plus-address such as founder+test1@example.com.",
  );
  process.exit(1);
}

if (!isTestAccountEmail(email)) {
  console.error(
    "Refusing to continue. Demo data is only for a test account such as name+test1@example.com.",
  );
  process.exit(1);
}

try {
  const account = await lookupAccountByEmail(email);
  if (!account) {
    console.error("No account uses that email. Sign up and confirm it first.");
    process.exit(1);
  }
  if (reset) {
    await resetTestAccountData(account.id);
    console.log("Reset the test account's plans. The sign-in was left in place.");
  } else {
    await seedTestAccountDemo(account.id);
    console.log("Added a sample budget, portfolio, and Retire plan.");
  }
} catch (error) {
  const message =
    error instanceof AdminServiceError
      ? error.message
      : "Could not update the test account.";
  console.error(message);
  process.exit(1);
}
