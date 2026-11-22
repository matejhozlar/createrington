import {
  CATEGORY_CONFIG,
  STATUS_CONFIG,
} from "@/features/admin/planning/constants";
import { markdownPreview } from "@/features/admin/planning/format";
import type { PlanCreateAction, PlanUpdateAction } from "../actions";

interface PlanActionPreviewProps {
  action: PlanCreateAction | PlanUpdateAction;
}

export function PlanActionPreview({ action }: PlanActionPreviewProps) {
  const preview = markdownPreview(action.body ?? null);
  const details = [
    action.type === "plan_create" ? STATUS_CONFIG.draft.label : null,
    action.type === "plan_update" && action.status
      ? `Status: ${STATUS_CONFIG[action.status].label}`
      : null,
    action.category ? CATEGORY_CONFIG[action.category].label : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-2.5 py-2">
      {action.title && (
        <p className="break-words text-sm font-semibold">{action.title}</p>
      )}
      {details.length > 0 && (
        <p className="text-[0.6875rem] text-muted-foreground">
          {details.join(" · ")}
        </p>
      )}
      {preview && (
        <p className="line-clamp-4 break-words text-xs text-muted-foreground">
          {preview}
        </p>
      )}
    </div>
  );
}
