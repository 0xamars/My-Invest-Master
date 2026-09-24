import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · InvestSalsa",
  description: "Sign in to Budget, Invest, and Retire on InvestSalsa.",
};

export default function LoginPage() {
  return (
    <AuthPageShell eyebrow="Account">
      <Suspense fallback={<p className="type-small text-[var(--fg-muted)]">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthPageShell>
  );
}
