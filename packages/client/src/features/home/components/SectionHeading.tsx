import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: ReactNode;
  subtitle: ReactNode;
  id?: string;
  className?: string;
  subtitleClassName?: string;
}

export function SectionHeading({
  title,
  subtitle,
  id,
  className,
  subtitleClassName,
}: SectionHeadingProps) {
  return (
    <div id={id} className={cn("flex flex-col gap-3", className)}>
      <h2 className="text-4xl md:text-5xl font-semibold text-foreground">
        {title}
      </h2>
      <p
        className={cn(
          "text-lg md:text-xl text-primary max-w-2xl",
          subtitleClassName,
        )}
      >
        {subtitle}
      </p>
    </div>
  );
}
