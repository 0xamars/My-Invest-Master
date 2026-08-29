import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandStill({
  src,
  alt,
  width,
  height,
  className,
  imageClassName,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius)] border border-border bg-card",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
    </div>
  );
}
