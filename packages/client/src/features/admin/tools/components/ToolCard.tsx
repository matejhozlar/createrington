import { ArrowUpRight, Pin, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ToolCard({
  title,
  description,
  section,
  icon: Icon,
  active,
  pinned,
  onOpen,
  onActivate,
  onDeactivate,
  onTogglePin,
}: {
  title: string;
  description: string;
  section: string;
  icon: LucideIcon;
  active: boolean;
  pinned: boolean;
  onOpen: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className="relative h-full"
      onMouseMove={(event) => {
        if (event.movementX !== 0 || event.movementY !== 0) onActivate();
      }}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex h-full w-full cursor-pointer flex-col items-stretch gap-3 rounded-xl border bg-card p-4 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
          active ? "border-primary/40" : "border-border",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
            <Icon className="size-5" />
          </span>
          <span className="min-w-0 flex-1 pr-6 text-[15px] font-semibold">
            {title}
          </span>
        </div>
        <p className="text-[13px] leading-normal text-pretty text-muted-foreground">
          {description}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
            {section}
          </span>
          <ArrowUpRight
            className={cn(
              "size-4 transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
        aria-pressed={pinned}
        className={cn(
          "absolute right-3 top-3.5 flex size-7 cursor-pointer items-center justify-center rounded-sm outline-none transition-[opacity,background-color] hover:bg-accent hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50",
          pinned ? "text-primary" : "text-muted-foreground opacity-35",
        )}
      >
        <Pin className="size-3.5" />
      </button>
    </div>
  );
}
