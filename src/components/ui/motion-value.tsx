"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Fades when the displayed number changes. Still text; reduced motion skips the fade. */
export function MotionValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const previous = useRef(value);
  const [shift, setShift] = useState(false);

  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setShift(true);
    const timer = window.setTimeout(() => setShift(false), 180);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <p className={cn("motion-value", shift && "motion-value--shift", className)}>
      {value}
    </p>
  );
}
