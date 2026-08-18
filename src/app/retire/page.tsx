import { RequireAuth } from "@/components/auth/require-auth";
import { RetireHomeContent } from "@/components/retire/retire-home-content";

export default function RetirePage() {
  return (
    <RequireAuth
      title="Sign in to open Retire"
      description="Retirement plans are tied to your account. Sign in to continue."
    >
      <RetireHomeContent />
    </RequireAuth>
  );
}
