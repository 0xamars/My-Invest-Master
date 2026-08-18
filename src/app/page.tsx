import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { MarketingHomeContent } from "@/components/home/marketing-home-content";

export const metadata: Metadata = {
  title: "InvestSalsa — Budget, Invest, Retire",
  description:
    "YNAB-style budgeting, portfolio tracking, and a retirement planner that shows your target, on-track verdict, and what-ifs.",
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
