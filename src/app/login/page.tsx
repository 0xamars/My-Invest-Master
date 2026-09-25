import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in · InvestSalsa",
  description: "Sign in to Budget, Invest, and Retire on InvestSalsa.",
};

type LoginSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearchParams>;
}) {
  const params = await searchParams;

  return (
    <AuthPageShell eyebrow="Account">
      <LoginForm
        nextPath={firstParam(params.next)}
        authError={firstParam(params.error) === "auth"}
        confirmEmailNotice={firstParam(params.notice) === "confirm-email"}
      />
    </AuthPageShell>
  );
}
