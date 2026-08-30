/**
 * Account menu initials must not throw on missing user / email / metadata.
 *   npx tsx --tsconfig tsconfig.json scripts/test-account-menu-unit.mts
 */
import {
  accountInitial,
  accountLabel,
} from "../src/lib/layout/account-initial.ts";
import { signOutThenGoHome } from "../src/lib/layout/sign-out-home.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

assert(accountInitial(null) === "A", "null user falls back to A");
assert(accountInitial(undefined) === "A", "undefined user falls back to A");
assert(accountInitial({}) === "A", "empty user falls back to A");
assert(accountInitial({ email: null }) === "A", "null email falls back to A");
assert(accountInitial({ email: "" }) === "A", "empty email falls back to A");
assert(accountInitial({ email: "alex@example.com" }) === "A", "email initial");
assert(
  accountInitial({
    email: "b@example.com",
    user_metadata: { full_name: "Zed" },
  }) === "Z",
  "display name wins over email",
);
assert(
  accountInitial({ user_metadata: { name: 1 } }) === "A",
  "non-string metadata is ignored",
);
assert(accountLabel(null) === null, "missing user has no label");
assert(
  accountLabel({ email: "alex@example.com" }) === "alex@example.com",
  "email is a safe label",
);

let signedOut = false;
let wentHome = false;
await signOutThenGoHome(
  async () => {
    signedOut = true;
  },
  () => {
    wentHome = true;
  },
);
assert(signedOut && wentHome, "sign out then marketing home");

wentHome = false;
try {
  await signOutThenGoHome(
    async () => {
      throw new Error("signOut failed");
    },
    () => {
      wentHome = true;
    },
  );
} catch {
  /* expected */
}
assert(wentHome, "marketing home still runs if signOut throws");

if (failed) {
  console.error(`\n${failed} account-menu assertion(s) failed`);
  process.exit(1);
}
console.log("\nall account-menu assertions passed");
