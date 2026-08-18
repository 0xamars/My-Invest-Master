import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { MarketingHomeContent } from "@/components/home/marketing-home-content";

export const metadata: Metadata = {
  title: "InvestSalsa — Budget, Invest, Retire",
  description:
    "Budget with Ready to Assign, leftover that carries, a register, and CSV import. Portfolio checkup for concentration and mix, plus a retirement planner with target, on-track verdict, and what-ifs. Not investment advice.",
};

function HomeLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[#050505]">
      <RefreshCw className="size-5 animate-spin text-white/50" />
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <MarketingHomeContent />
    </Suspense>
  );
}
