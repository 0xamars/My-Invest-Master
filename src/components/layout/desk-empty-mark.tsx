/**
 * Decorative marks for empty states. CSS/SVG only — no stock art.
 */
export function DeskEmptyMark({
  kind,
}: {
  kind: "budget" | "invest" | "retire";
}) {
  return (
    <div className="desk-empty-mark" aria-hidden>
      {kind === "budget" ? <BudgetMark /> : null}
      {kind === "invest" ? <InvestMark /> : null}
      {kind === "retire" ? <RetireMark /> : null}
    </div>
  );
}

function BudgetMark() {
  return (
    <svg viewBox="0 0 72 56" fill="none">
      <rect
        x="8"
        y="30"
        width="42"
        height="16"
        rx="4"
        stroke="var(--brand-green)"
        strokeWidth="1.5"
      />
      <path d="M8 36.5h42" stroke="var(--brand-green)" strokeWidth="1.5" />
      <rect
        x="20"
        y="16"
        width="42"
        height="16"
        rx="4"
        stroke="var(--brand-orange-text)"
        strokeWidth="1.5"
      />
      <path d="M20 22.5h42" stroke="var(--brand-orange-text)" strokeWidth="1.5" />
      <circle cx="56" cy="12" r="5" fill="var(--brand-green)" />
    </svg>
  );
}

function InvestMark() {
  return (
    <svg viewBox="0 0 72 56" fill="none">
      <path d="M8 46h56" stroke="var(--muted-foreground)" strokeWidth="1.5" />
      <rect x="12" y="30" width="10" height="16" rx="2" fill="var(--brand-green)" opacity="0.35" />
      <rect x="30" y="20" width="10" height="26" rx="2" fill="var(--brand-green)" opacity="0.65" />
      <rect x="48" y="10" width="10" height="36" rx="2" fill="var(--brand-green)" />
    </svg>
  );
}

function RetireMark() {
  return (
    <svg viewBox="0 0 72 56" fill="none">
      <path
        d="M8 42c10-20 46-20 56 0"
        stroke="var(--brand-green)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14 42c8-14 36-14 44 0"
        stroke="var(--brand-orange-text)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="36" cy="18" r="3.5" fill="var(--brand-green)" />
    </svg>
  );
}
