"use client";

export function FreedomDoNudge({ hasBook }: { hasBook: boolean }) {
  if (hasBook) return null;
  return (
    <p className="text-sm text-muted-foreground">
      You can learn Freedom Do anytime. Saving a plan is more useful after a
      book exists. A date still needs leftover and the book — this page will
      not invent one.
    </p>
  );
}
