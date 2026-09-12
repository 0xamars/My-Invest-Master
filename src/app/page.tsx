import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { RootHomeContent } from "@/components/home/root-home-content";

export const metadata: Metadata = {
  title: "InvestSalsa — Freedom, Engineered.",
  description:
    "Budget, Invest, and Retire. Ready to Assign leftover that carries, a register, and CSV import. Portfolio checkup for concentration and mix, plus a Retire plan with target, on-track verdict, and what-ifs. Not investment advice.",
};

function HomeLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <RefreshCw className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <RootHomeContent />
    </Suspense>
  );
}
