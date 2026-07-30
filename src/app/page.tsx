import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { MarketingHomeContent } from "@/components/home/marketing-home-content";

export const metadata: Metadata = {
  title: "InvestSalsa — Budget, Invest, Retire",
  description:
    "Build financial independence with clarity. Budget, Invest, and Retire work together in one modern workspace.",
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
