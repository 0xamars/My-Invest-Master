import {
  exampleLifetimeTaxDisplay,
  formatExampleCad,
} from "@/lib/retirement/example-couple";

const LABEL = "Example, made-up numbers. Not a recommendation.";

export function ExampleWithdrawalComparison() {
  const display = exampleLifetimeTaxDisplay();
  const max = display ? Math.max(...display.rows.map((row) => row.cad), 1) : 1;

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-6 sm:px-8 sm:py-10">
      <div className="max-w-xl">
        <h2 className="type-h2 text-balance">Same savings. Different order.</h2>
        <p className="type-small mt-2 text-[var(--fg-muted)]">{LABEL}</p>
        {display?.allFunded ? (
          <>
            <p className="type-small mt-8 text-right text-[var(--fg-muted)]">Lifetime tax</p>
            <ol className="mt-3 space-y-4">
              {display.rows.map((row) => (
                <li key={row.label}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium">{row.label}</span>
                    <span className="text-sm tabular-nums">
                      <span className="sr-only">lifetime tax </span>
                      {formatExampleCad(row.cad)}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((row.cad / max) * 1000) / 10}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-pretty text-base leading-relaxed">
              In this example, the order alone changes lifetime tax by{" "}
              {formatExampleCad(display.deltaCad)}.
            </p>
          </>
        ) : (
          <p className="type-small mt-6 text-[var(--fg-muted)]">
            This illustration needs an age and a spending amount before it can run.
          </p>
        )}
      </div>
    </section>
  );
}
