import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectThumb } from "./ProjectThumb";

const SHOWN_COUNT = 4;

export function PackStrip({
  slug,
  mods,
  className,
  children,
}: {
  slug: string;
  mods: Array<{
    id: number;
    project: { name: string; thumbnailUrl: string | null };
  }>;
  className?: string;
  children: ReactNode;
}) {
  const shown = mods.slice(0, SHOWN_COUNT);
  const extra = mods.length - shown.length;
  return (
    <Link
      to={`/workshop/${slug}/pack`}
      className={cn(
        "flex flex-wrap items-center gap-3.5 rounded-xl border border-border bg-accent/15 px-5 py-3.5 text-inherit transition-colors hover:border-primary/40",
        className,
      )}
    >
      {children}
      {mods.length > 0 && (
        <span className="flex items-center gap-1.5">
          {shown.map((mod) => (
            <ProjectThumb
              key={mod.id}
              name={mod.project.name}
              thumbnailUrl={mod.project.thumbnailUrl}
              title={mod.project.name}
              className="size-8 rounded-lg text-[10px]"
            />
          ))}
          {extra > 0 && (
            <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground">
              +{extra}
            </span>
          )}
        </span>
      )}
      <span className="flex-1" />
      <span className="flex items-center gap-1 text-[13px] whitespace-nowrap text-muted-foreground">
        Browse the full pack
        <ArrowRight className="size-[15px]" />
      </span>
    </Link>
  );
}
