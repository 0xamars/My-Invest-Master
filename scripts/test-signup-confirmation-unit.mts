/**
 * Signup stays on a check-email state when Supabase returns no session.
 * Login explains an unconfirmed account. Confirmation off still enters the app.
 *   npx tsx --tsconfig tsconfig.json scripts/test-signup-confirmation-unit.mts
 */
import { readFileSync } from "node:fs";
import {
  CHECK_YOUR_EMAIL_MESSAGE,
  UNCONFIRMED_ACCOUNT_MESSAGE,
  explainSignInError,
  signupNextStep,
  signupOutcome,
} from "../src/lib/auth/confirmation.ts";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`ok ${msg}`);
  }
}

const pending = signupOutcome({
  user: { id: "user-1" },
  session: null,
  errorMessage: null,
});
assert(pending.needsEmailConfirmation, "confirm-email on: user without session");
assert(pending.error == null, "pending confirmation is not an error");
assert(signupNextStep(pending) === "check-email", "pending confirmation stays on check-email");

const signedIn = signupOutcome({
  user: { id: "user-1" },
  session: { access_token: "session" },
  errorMessage: null,
});
assert(!signedIn.needsEmailConfirmation, "confirm-email off: session means signed in");
assert(signupNextStep(signedIn) === "enter-app", "session enters the app");

const rejected = signupOutcome({
  user: null,
  session: null,
  errorMessage: "User already registered",
});
assert(signupNextStep(rejected) === "show-error", "signup error is shown");
assert(!rejected.needsEmailConfirmation, "signup error does not ask for email");

const empty = signupOutcome({
  user: null,
  session: null,
  errorMessage: null,
});
assert(signupNextStep(empty) === "show-error", "missing user and session is an error");

assert(
  explainSignInError({ message: "Email not confirmed", code: "email_not_confirmed" }) ===
    UNCONFIRMED_ACCOUNT_MESSAGE,
  "email_not_confirmed explains the account is unconfirmed",
);
assert(
  explainSignInError({ message: "Email not confirmed" }) === UNCONFIRMED_ACCOUNT_MESSAGE,
  "legacy Email not confirmed message is explained",
);
assert(
  explainSignInError({ message: "Invalid login credentials", code: "invalid_credentials" }) ===
    "Invalid login credentials",
  "other sign-in errors stay specific",
);
assert(explainSignInError(null) == null, "no error stays empty");
assert(
  CHECK_YOUR_EMAIL_MESSAGE.toLowerCase().includes("check your email"),
  "check-email copy names the inbox",
);

const signupForm = readFileSync("src/components/auth/signup-form.tsx", "utf8");
assert(!signupForm.includes("setTimeout"), "signup no longer redirects on a timer");
assert(signupForm.includes("check-email"), "signup renders a check-email state");
assert(
  signupForm.includes("signupNextStep"),
  "signup uses the confirmation outcome",
);

const loginForm = readFileSync("src/components/auth/login-form.tsx", "utf8");
assert(
  readFileSync("src/hooks/use-auth.tsx", "utf8").includes("explainSignInError"),
  "login errors go through the unconfirmed-account explanation",
);
assert(loginForm.includes("role=\"alert\""), "login surfaces the sign-in explanation");
assert(
  loginForm.includes("notice") && loginForm.includes("CHECK_YOUR_EMAIL_MESSAGE"),
  "login explains an unconfirmed account from the check-email handoff",
);

if (failed) {
  console.error(`\n${failed} signup-confirmation assertion(s) failed`);
  process.exit(1);
}
console.log("\nall signup-confirmation assertions passed");
