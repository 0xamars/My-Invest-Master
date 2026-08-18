import type { Metadata } from "next";
import { PricingContent } from "@/components/pricing/pricing-content";

export const metadata: Metadata = {
  title: "Pricing · InvestSalsa",
  description:
    "Free includes one budget, one portfolio, and one retirement plan. Premium is unlimited plans and retire-from-portfolio.",
};

export default function PricingPage() {
  return <PricingContent />;
}
