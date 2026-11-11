import { useState } from "react";
import { X } from "lucide-react";
import { trpc, type RouterOutput, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProjectThumb } from "../../components/ProjectThumb";
import { MOD_STATUS_STYLES } from "../../format";
import { useMutation } from "@tanstack/react-query";

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
  const [confirmMod, setConfirmMod] = useState<Suggestion | null>(null);

  const pending = suggestions.filter((m) => m.status === "pending");
  const emptySlots = Math.max(0, workshop.maxModsPerUser - pending.length);

  const removeMutation = useMutation(
    trpc.user.workshops.removeSuggestion.mutationOptions(
      useMutationToast({
        success: "Suggestion removed",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.user.workshops.mySuggestions.queryFilter({
              workshopId: workshop.id,
            }),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.mySuggestionHistory.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.searchProjects.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.get.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.myUpvotes.queryFilter({
              workshopId: workshop.id,
            }),
          );
        },
      }),
    ),
  );

  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="text-2xl font-semibold">My active suggestions</h2>
        <span
          className="text-sm whitespace-nowrap text-primary"
          style={{ fontFamily: SLOT_FONT }}
        >
          {pending.length} / {workshop.maxModsPerUser}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Only suggestions in review use a slot. Approved and ruled-out ones free
        it back up.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {pending.map((mod) => {
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
                <Badge tone={MOD_STATUS_STYLES.pending.tone}>
                  {MOD_STATUS_STYLES.pending.label}
                </Badge>
                {isOpen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Remove suggestion"
                        disabled={removeMutation.isPending}
                        onClick={() => setConfirmMod(mod)}
                      >
                        <X />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove suggestion</TooltipContent>
                  </Tooltip>
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

      <ConfirmDialog
        open={confirmMod !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmMod(null);
        }}
        title="Remove suggestion?"
        description={
          <>
            &ldquo;{confirmMod?.project.name}&rdquo; will be removed from review
            and its upvotes will be lost. This frees the slot back up.
          </>
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() =>
          confirmMod
            ? removeMutation.mutateAsync({ workshopModId: confirmMod.id })
            : undefined
        }
      />
    </section>
  );
}
