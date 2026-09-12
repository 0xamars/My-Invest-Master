import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/lib/routes";

export default function MoneyProfileRedirectPage() {
  redirect(APP_HOME_PATH);
}
