import { useState } from "react";
import { CircleCheck, ExternalLink, Eye, PackageMinus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CellDate, CellText } from "@/components/cell-text";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { CardEmpty, CardError } from "@/features/admin/components/CardState";
import { isHttpUrl } from "@/features/workshop/format";
import type { ModEnvironment } from "@createrington/shared/db";
import {
  EnvironmentCell,
  type EnvironmentDisplay,
} from "@/features/workshop/components/EnvironmentCell";
import type { AttentionItem } from "../../types";

type DependencyGap = Extract<
  AttentionItem["type"],
  "rejected_dependency" | "unpromoted_dependency"
>;

const DEPENDENCY_GAP_MESSAGES: Record<DependencyGap, string> = {
  rejected_dependency: "but is ruled out in this workshop.",
  unpromoted_dependency:
    "but is still in review, so the pack would ship without it.",
};

const ATTENTION_MESSAGES: Record<
  Exclude<AttentionItem["type"], DependencyGap>,
  string
> = {
  dropped_from_pack: "was live but is missing from the latest published pack.",
  shipped_unreviewed:
    "shipped in the pack but its suggestion never finished review, so the suggester is uncredited.",
  shipped_rejected: "shipped in the pack but is rejected in this workshop.",
  environment_unspecified:
    "has no environment flag yet, which blocks approval past testing. Flag whether it runs client or server side:",
  duplicate_manifest_entry:
    "appears more than once in the published pack manifest. Publish a build that lists it once.",
};

type DroppedItem = Extract<AttentionItem, { type: "dropped_from_pack" }>;

const REMOVE_COPY = {
  common:
    "This clears the issue and takes the mod off the In Pack tab and the public pack page.",
  suggestion:
    "Its suggestion is ruled out so it stops queuing for the next update; re-review it later if you change your mind.",
  returning:
    "If a future release ships the mod again, it rejoins the pack on its own.",
};

function isDependencyGap(
  item: AttentionItem,
): item is Extract<AttentionItem, { requiredBy: unknown }> {
  return (
    item.type === "rejected_dependency" || item.type === "unpromoted_dependency"
  );
}

export function IssuesTab({
  workshopId,
  items,
  isLoading,
  error,
  onRetry,
  onView,
  onResolved,
  unresolvedCount,
  envDisplay,
  onSetEnvironment,
}: {
  workshopId: number;
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onView: (workshopModId: number) => void;
  onResolved: () => unknown;
  unresolvedCount: number;
  envDisplay: EnvironmentDisplay;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}) {
  const toast = useToastActions();
  const [removeTarget, setRemoveTarget] = useState<DroppedItem | null>(null);
  const displayTarget = useStickyValue(removeTarget);

  const removeMutation = trpc.admin.workshops.removeDroppedMember.useMutation({
    onSuccess: () => {
      toast.success("Removed from the pack");
      onResolved();
    },
    onError: (err) => {
      toast.error(err.message);
      onResolved();
    },
  });

  const columns: DataTableColumn<AttentionItem>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 180,
      render: (item) =>
        isHttpUrl(item.websiteUrl) ? (
          <a
            href={item.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${item.name} on CurseForge`}
            className="flex min-w-0 items-center gap-1 hover:underline"
          >
            <CellText value={item.name} className="min-w-0 font-medium" />
            <ExternalLink
              aria-hidden
              className="size-3 shrink-0 text-muted-foreground"
            />
          </a>
        ) : (
          <CellText value={item.name} className="font-medium" />
        ),
    },
    {
      key: "problem",
      header: "Problem",
      minWidth: 320,
      cellClassName: "whitespace-normal",
      render: (item) => (
        <>
          <p className="text-sm text-muted-foreground">
            {isDependencyGap(item) ? (
              <>
                is required by{" "}
                <span className="font-medium text-foreground">
                  {item.requiredBy.map((entry) => entry.name).join(", ")}
                </span>{" "}
                {DEPENDENCY_GAP_MESSAGES[item.type]}
              </>
            ) : (
              ATTENTION_MESSAGES[item.type]
            )}
          </p>
          {item.type === "dropped_from_pack" && (
            <CellDate value={item.droppedAt} className="text-xs" />
          )}
          {item.type === "environment_unspecified" && (
            <div className="pt-1.5">
              <EnvironmentCell
                projectId={item.curseforgeProjectId}
                environment="unspecified"
                source={null}
                display={envDisplay}
                onSetEnvironment={onSetEnvironment}
              />
            </div>
          )}
        </>
      ),
    },
  ];

  const itemActions = (item: AttentionItem): DataTableAction[] => {
    const actions: DataTableAction[] = [];
    const workshopModId = "workshopModId" in item ? item.workshopModId : null;
    if (workshopModId !== null) {
      actions.push({
        label: "View Mod",
        icon: Eye,
        onClick: () => onView(workshopModId),
      });
    }
    if (item.type === "dropped_from_pack") {
      actions.push({
        label: "Remove from Pack",
        icon: PackageMinus,
        variant: "destructive",
        onClick: () => setRemoveTarget(item),
      });
    }
    return actions;
  };

  return (
    <>
      <Card className="gap-0">
        <CardHeader className="gap-0 border-b">
          <CardTitle>Issues ({unresolvedCount.toLocaleString()})</CardTitle>
        </CardHeader>

        {error ? (
          <CardError message={error} onRetry={onRetry} />
        ) : !isLoading && items.length === 0 ? (
          <CardEmpty icon={CircleCheck} message="Nothing needs attention" />
        ) : (
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              rows={items}
              loading={isLoading}
              rowKey={(item) => `${item.type}-${item.curseforgeProjectId}`}
              actions={itemActions}
            />

            {!isLoading && (
              <p className="px-4 pt-4 text-xs text-muted-foreground">
                Showing {unresolvedCount}{" "}
                {unresolvedCount === 1 ? "issue" : "issues"}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={`Remove ${displayTarget?.name ?? "this mod"} from the pack?`}
        description={[
          REMOVE_COPY.common,
          displayTarget && displayTarget.workshopModId !== null
            ? REMOVE_COPY.suggestion
            : null,
          REMOVE_COPY.returning,
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() =>
          removeTarget
            ? removeMutation.mutateAsync({
                workshopId,
                modpackModId: removeTarget.modpackModId,
              })
            : undefined
        }
      />
    </>
  );
}
