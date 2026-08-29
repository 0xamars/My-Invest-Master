"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function InlineTitle({
  value,
  onCommit,
  ariaLabel,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (!trimmed) {
      setDraft(value);
      return;
    }
    if (trimmed !== value) onCommit(trimmed);
    setDraft(trimmed);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${ariaLabel}. Click to rename`}
        title="Rename"
        className={cn(
          "min-w-0 truncate rounded-md px-1 py-0.5 text-left text-[1.65rem] font-semibold tracking-tight text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn(
        "min-w-0 max-w-xl rounded-md border border-border bg-muted px-2 py-0.5 text-[1.65rem] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    />
  );
}
