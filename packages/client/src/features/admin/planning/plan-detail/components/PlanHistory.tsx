import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatRelativeDate } from "@/lib/format";
import { queryClient, trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PersonChip } from "../../components/PersonChip";
import { PlanMarkdown } from "../../components/PlanMarkdown";
import { describeRevision } from "../../format";
import type { PlanningRevision, PlanningSubcategory } from "../../types";

interface PlanHistoryProps {
  itemId: number;
  currentRevision: number;
  revisions: PlanningRevision[];
  subcategories: PlanningSubcategory[];
}

export function PlanHistory({
  itemId,
  currentRevision,
  revisions,
  subcategories,
}: PlanHistoryProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const restore = useMutation(
    trpc.admin.planning.items.restore.mutationOptions(
      useMutationToast({
        success: "Version restored",
        onSuccess: () => {
          void queryClient.invalidateQueries(trpc.admin.planning.pathFilter());
          setExpandedId(null);
        },
      }),
    ),
  );

  return (
    <ol className="flex flex-col gap-3">
      {revisions.map((revision, index) => {
        const expanded = expandedId === revision.id;
        const changes = describeRevision(
          revision,
          revisions[index + 1],
          subcategories,
        );

        return (
          <li
            key={revision.id}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <PersonChip person={revision.editedBy} />
              <span className="text-xs text-muted-foreground">
                {formatRelativeDate(revision.createdAt)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label={
                  expanded ? "Hide this version" : "Show this version"
                }
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : revision.id)}
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </Button>
            </div>

            <ul className="text-sm text-muted-foreground">
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>

            {expanded && (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                <p className="break-words text-sm font-semibold">
                  {revision.title}
                </p>
                {revision.body ? (
                  <PlanMarkdown text={revision.body} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No description.
                  </p>
                )}

                {revision.revision !== currentRevision && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    loading={restore.isPending}
                    onClick={() =>
                      restore.mutate({
                        id: itemId,
                        revision: currentRevision,
                        revisionId: revision.id,
                      })
                    }
                  >
                    <RotateCcw className="size-4" />
                    Restore this version
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
