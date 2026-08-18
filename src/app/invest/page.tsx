import { RequireAuth } from "@/components/auth/require-auth";
import { InvestHomeContent } from "@/components/invest/invest-home-content";

export default function InvestPage() {
  return (
    <RequireAuth
      title="Sign in to open Invest"
      description="Your portfolio checkup is tied to your account. Sign in to continue."
    >
      <InvestHomeContent />
    </RequireAuth>
  );
}
