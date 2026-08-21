import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account · InvestSalsa",
  description:
    "Create an InvestSalsa account for Home, Budget, Invest, and Freedom. Not investment advice.",
};

export default function SignupPage() {
  return (
    <AuthPageShell eyebrow="Start">
      <SignupForm />
    </AuthPageShell>
  );
}
