import { redirect } from "next/navigation";
import { INVEST_WATCHLIST_PATH } from "@/lib/chrome/nav";

export default function WatchlistPage() {
  redirect(INVEST_WATCHLIST_PATH);
}
