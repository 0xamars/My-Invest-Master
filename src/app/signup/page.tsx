import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account · InvestSalsa",
  description:
    "Start free with one budget, one portfolio, and one retirement plan.",
};

export default function SignupPage() {
  return (
    <AuthPageShell eyebrow="Start free">
      <SignupForm />
    </AuthPageShell>
  );
}
