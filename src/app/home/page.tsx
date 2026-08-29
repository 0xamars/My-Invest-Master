import { RequireAuth } from "@/components/auth/require-auth";
import { JourneyHomeContent } from "@/components/journey/journey-home-content";

export default function JourneyHomePage() {
  return (
    <RequireAuth
      title="Sign in to open your Journey"
      description="Journey Home is tied to your account. Sign in to continue."
    >
      <JourneyHomeContent />
    </RequireAuth>
  );
}
