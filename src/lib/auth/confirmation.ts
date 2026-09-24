/**
 * Supabase signUp: confirm-email on returns a user and a null session.
 * Confirm-email off returns both a user and a session.
 * https://supabase.com/docs/reference/javascript/auth-signup
 */
export const CHECK_YOUR_EMAIL_MESSAGE =
  "Check your email to confirm this account. Open the link we sent, then sign in. You stay on this page until the account is confirmed.";

export const UNCONFIRMED_ACCOUNT_MESSAGE =
  "This account is not confirmed yet. Check your email for the confirmation link, then sign in.";

export type SignupOutcome = {
  error: string | null;
  needsEmailConfirmation: boolean;
};

export function signupOutcome(input: {
  user: unknown | null;
  session: unknown | null;
  errorMessage: string | null;
}): SignupOutcome {
  if (input.errorMessage) {
    return { error: input.errorMessage, needsEmailConfirmation: false };
  }
  if (input.session) {
    return { error: null, needsEmailConfirmation: false };
  }
  if (input.user) {
    return { error: null, needsEmailConfirmation: true };
  }
  return {
    error: "Account was not created. Try again.",
    needsEmailConfirmation: false,
  };
}

export function signupNextStep(
  outcome: SignupOutcome,
): "check-email" | "enter-app" | "show-error" {
  if (outcome.error) return "show-error";
  return outcome.needsEmailConfirmation ? "check-email" : "enter-app";
}

export function isUnconfirmedAccountError(
  error: { message?: string | null; code?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "email_not_confirmed") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("email not confirmed");
}

export function explainSignInError(
  error: { message?: string | null; code?: string | null } | null | undefined,
): string | null {
  if (!error) return null;
  if (isUnconfirmedAccountError(error)) return UNCONFIRMED_ACCOUNT_MESSAGE;
  const message = error.message?.trim();
  return message && message.length > 0 ? message : "Unable to sign in.";
}
