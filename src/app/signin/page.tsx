import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/routes";

export default function SigninPage() {
  redirect(LOGIN_PATH);
}
