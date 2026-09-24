import type { Metadata } from "next";
import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { RootHomeContent } from "@/components/home/root-home-content";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/brand/assets";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
};

function HomeLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <RefreshCw className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function PublicHomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <RootHomeContent />
    </Suspense>
  );
}
