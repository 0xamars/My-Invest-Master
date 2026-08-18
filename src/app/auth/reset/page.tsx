import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password · InvestSalsa",
  description: "Choose a new password for your InvestSalsa account.",
};

export default function AuthResetPage() {
  return (
    <AuthPageShell eyebrow="Password">
      <ResetPasswordForm />
    </AuthPageShell>
  );
}
