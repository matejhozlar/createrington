import { CircleCheck, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CellDate, CellText } from "@/components/cell-text";
import {
  DataTable,
  type DataTableAction,
  type DataTableColumn,
} from "@/components/data-table";
import { CardEmpty, CardError } from "@/features/admin/components/CardState";
import type { ModEnvironment } from "@createrington/shared/db";
import {
  EnvironmentCell,
  type EnvironmentOverride,
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

function isDependencyGap(
  item: AttentionItem,
): item is Extract<AttentionItem, { requiredByName: string }> {
  return (
    item.type === "rejected_dependency" || item.type === "unpromoted_dependency"
  );
}

export function IssuesTab({
  items,
  isLoading,
  error,
  onRetry,
  onView,
  envOverride,
  onSetEnvironment,
}: {
  items: AttentionItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onView: (workshopModId: number) => void;
  envOverride: EnvironmentOverride | null;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}) {
  const columns: DataTableColumn<AttentionItem>[] = [
    {
      key: "mod",
      header: "Mod",
      minWidth: 180,
      render: (item) => <CellText value={item.name} className="font-medium" />,
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
                  {item.requiredByName}
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
                override={envOverride}
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
    if ("workshopModId" in item) {
      actions.push({
        label: "View Mod",
        icon: Eye,
        onClick: () => onView(item.workshopModId),
      });
    }
    return actions;
  };

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>Issues ({items.length.toLocaleString()})</CardTitle>
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
              Showing {items.length} {items.length === 1 ? "issue" : "issues"}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
