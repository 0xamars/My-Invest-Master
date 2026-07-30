import { RequireAuth } from "@/components/auth/require-auth";

export default function BudgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth
      title="Sign in to manage your budget"
      description="Your budget plans are saved to your account and synced across devices."
    >
      {children}
    </RequireAuth>
  );
}
