import { ArrowUpRight, Pin, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToolCard({
  title,
  description,
  section,
  icon: Icon,
  pinned,
  onOpen,
  onTogglePin,
}: {
  title: string;
  description: string;
  section: string;
  icon: LucideIcon;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className="group relative h-full">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full cursor-pointer flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-4 text-left outline-none transition-colors group-hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1 pr-8 font-medium">{title}</span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section}
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onTogglePin}
        aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
        aria-pressed={pinned}
        className={cn(
          "absolute right-2 top-4",
          pinned ? "text-primary hover:text-primary" : "text-muted-foreground",
        )}
      >
        <Pin />
      </Button>
    </div>
  );
}
