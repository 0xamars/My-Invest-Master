import { redirect } from "next/navigation";
import { INVEST_OPTIONS_PATH } from "@/lib/chrome/nav";

export default function OptionsPage() {
  redirect(INVEST_OPTIONS_PATH);
}
