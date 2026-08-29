"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMoneyProfile } from "@/hooks/use-money-profile";
import { confirmOptionsUse } from "@/lib/journey/locks";

export function OptionsConfirmGate({
  onConfirm,
  isSaving = false,
}: {
  onConfirm: () => void | Promise<void>;
  isSaving?: boolean;
}) {
  const { profile } = useMoneyProfile();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    try {
      await onConfirm();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : profile
            ? "Unable to save that confirm."
            : "Unable to open Options.",
      );
    }
  }

  return (
    <div
      className="surface-card flex flex-1 flex-col gap-4 px-5 py-6"
      data-options-gate="1"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Confirm
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          Options can lose more than you put in
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is a premium ledger against the book — not a strategy picker.
          Confirm you want to use it. Fast Track and tools skip this step.
        </p>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div>
        <Button
          type="button"
          disabled={isSaving}
          onClick={() => void handleConfirm()}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          I understand — open Options
        </Button>
      </div>
    </div>
  );
}
