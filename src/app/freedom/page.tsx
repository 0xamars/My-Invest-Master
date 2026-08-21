import { RequireAuth } from "@/components/auth/require-auth";
import { RetireHomeContent } from "@/components/retire/retire-home-content";

export default function FreedomPage() {
  return (
    <RequireAuth
      title="Sign in to open Freedom"
      description="Freedom plans are tied to your account. Sign in to continue."
    >
      <RetireHomeContent />
    </RequireAuth>
  );
}
