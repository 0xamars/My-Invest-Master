import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { HomeContent } from "@/components/home/home-content";

function HomeLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <RefreshCw className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}
