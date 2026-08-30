"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { SETTINGS_PATH } from "@/lib/chrome/nav";

/**
 * Isolate the header account control. A menu bug must not white-screen the app.
 */
export class HeaderAccountBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Link
          href={SETTINGS_PATH}
          className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground"
          aria-label="Settings"
        >
          A
        </Link>
      );
    }
    return this.props.children;
  }
}
