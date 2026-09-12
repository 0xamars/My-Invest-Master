import { Loader2 } from "lucide-react";

export function PageLoading({ label }: { label: string }) {
  return (
    <div className="page-spinner" role="status" aria-live="polite">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
