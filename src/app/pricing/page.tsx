import { redirect } from "next/navigation";

/** /pricing is not a product page. Send visitors to the marketing home. */
export default function PricingPage() {
  redirect("/");
}
