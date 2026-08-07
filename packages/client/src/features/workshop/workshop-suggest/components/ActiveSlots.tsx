import { Loader2, X } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectThumb } from "../../components/ProjectThumb";
import { MOD_STATUS_STYLES } from "../../format";

type Suggestion = RouterOutput["user"]["workshops"]["mySuggestions"][number];

const SLOT_FONT = "'Minecraft', ui-monospace, monospace";

export function ActiveSlots({
  workshop,
  suggestions,
  isOpen,
}: {
  workshop: { id: number; maxModsPerUser: number };
  suggestions: Suggestion[];
  isOpen: boolean;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const pending = suggestions.filter((m) => m.status === "pending");
  const emptySlots = Math.max(0, workshop.maxModsPerUser - pending.length);

  const removeMutation = trpc.user.workshops.removeSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Suggestion removed");
      utils.user.workshops.mySuggestions.invalidate({
        workshopId: workshop.id,
      });
      utils.user.workshops.mySuggestionHistory.invalidate();
      utils.user.workshops.searchProjects.invalidate();
      utils.user.workshops.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="text-[22px] leading-7 font-semibold">
          My active suggestions
        </h2>
        <span
          className="text-sm whitespace-nowrap text-primary"
          style={{ fontFamily: SLOT_FONT }}
        >
          {pending.length} / {workshop.maxModsPerUser}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Only suggestions in review use a slot. Approved and ruled-out ones free
        it back up.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {pending.map((mod) => {
          const removing =
            removeMutation.isPending &&
            removeMutation.variables?.workshopModId === mod.id;
          return (
            <div
              key={mod.id}
              className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3.5 py-[9px]"
            >
              <ProjectThumb
                name={mod.project.name}
                thumbnailUrl={mod.project.thumbnailUrl}
                className="size-8 rounded-lg text-[11px]"
              />
              <span className="min-w-0 truncate text-[13.5px] font-semibold">
                {mod.project.name}
              </span>
              {mod.note && (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  &ldquo;{mod.note}&rdquo;
                </span>
              )}
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={MOD_STATUS_STYLES.pending.className}
                >
                  {MOD_STATUS_STYLES.pending.label}
                </Badge>
                {isOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-[26px] rounded-[7px]"
                    aria-label="Remove suggestion"
                    title="Remove suggestion"
                    disabled={removeMutation.isPending}
                    onClick={() =>
                      removeMutation.mutate({ workshopModId: mod.id })
                    }
                  >
                    {removing ? (
                      <Loader2 className="size-[13px] animate-spin" />
                    ) : (
                      <X className="size-[13px]" />
                    )}
                  </Button>
                )}
              </span>
            </div>
          );
        })}
        {Array.from({ length: emptySlots }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-[10px] border border-dashed border-[var(--border-strong)] px-3.5 py-[9px] opacity-60"
          >
            <span className="size-8 shrink-0 rounded-lg border border-dashed border-[var(--border-strong)]" />
            <span className="text-xs text-muted-foreground">Empty slot</span>
          </div>
        ))}
      </div>
    </section>
  );
}
