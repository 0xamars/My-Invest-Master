import { BrandWordmark } from "@/components/layout/brand-logo";
import { PublicFooter, PublicHeader } from "@/components/layout/public-chrome";

function AuthPanelMark() {
  return (
    <BrandWordmark
      className="h-14 w-auto max-w-[18rem] sm:h-[4.5rem] md:h-[4.5rem]"
      priority
    />
  );
}

export function AuthPageShell({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="marketing-home relative min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[minmax(16rem,28rem)_minmax(0,1fr)]">
      <div className="relative hidden min-h-svh items-center justify-center bg-card lg:flex">
        <AuthPanelMark />
      </div>

      <div className="relative flex min-h-svh flex-col">
        <PublicHeader innerClassName="max-w-lg" />

        <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-8 sm:py-12">
          <div className="surface-card px-6 py-8 sm:px-8">
            {eyebrow ? <p className="type-eyebrow mb-3 text-[var(--fg-eyebrow)]">{eyebrow}</p> : null}
            {children}
          </div>
        </main>

        <PublicFooter innerClassName="max-w-lg" />
      </div>
    </div>
  );
}
