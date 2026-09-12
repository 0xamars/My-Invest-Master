import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { SignedInHomeContent } from "@/components/home/signed-in-home-content";

export const metadata: Metadata = {
  title: "Home — InvestSalsa",
  description:
    "Signed-in overview of Budget leftover, the Invest book, and Retire. Not investment advice.",
};

export default function SignedInHomePage() {
  return (
    <RequireAuth
      title="Sign in to open Home"
      description="Home combines Budget, Invest, and Retire for your account. Sign in to continue."
    >
      <SignedInHomeContent />
    </RequireAuth>
  );
}
