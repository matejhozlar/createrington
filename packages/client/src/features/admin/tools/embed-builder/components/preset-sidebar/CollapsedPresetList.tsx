import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export function CollapsedPresetList({
  activeId,
  onLoad,
}: {
  activeId: number | undefined;
  onLoad: (preset: {
    id: number;
    name: string;
    data: unknown;
    categoryId?: number | null;
  }) => void;
}) {
  const recentQuery = useQuery(
    trpc.admin.embeds.presets.list.queryOptions({ limit: 6 }),
  );
  const recent = recentQuery.data?.presets ?? [];
  return (
    <div className="flex flex-col gap-1">
      {recent.map((p) => {
        const active = activeId === p.id;
        return (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onLoad(p)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md text-[13px] font-semibold uppercase transition-colors",
                  active
                    ? "border border-[var(--border-strong)] bg-card text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {p.name.charAt(0)}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{p.name}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
