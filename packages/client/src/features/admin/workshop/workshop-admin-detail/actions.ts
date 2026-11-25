import { Ban, Check, FlaskConical, Pencil, Undo2 } from "lucide-react";
import type { DataTableAction } from "@/components/data-table";
import {
  hasRuledOutRequiredDependency,
  WORKSHOP_MOD_REVIEW_TARGETS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";
import type { EnvironmentDisplay } from "@/features/workshop/components/EnvironmentCell";
import type { ModEnvironment } from "@createrington/shared/db";
import type {
  AdminWorkshopMod,
  RejectTarget,
} from "@/features/admin/workshop/workshop-admin-detail/types";

export interface ModReviewHandlers {
  onReview: (
    workshopModId: number,
    action: Exclude<WorkshopModReviewAction, "reject">,
  ) => void;
  onReject: (target: RejectTarget) => void;
}

export interface ModTableProps extends ModReviewHandlers {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
  envDisplay: EnvironmentDisplay;
  onSetEnvironment: (projectId: number, environment: ModEnvironment) => void;
}

export function modReviewActions(
  mod: AdminWorkshopMod,
  { onReview, onReject }: ModReviewHandlers,
  envDisplay?: EnvironmentDisplay,
): DataTableAction[] {
  const actions: DataTableAction[] = [];
  if (mod.status === "pending" || mod.status === "rejected") {
    actions.push({
      label: "Approve",
      icon: Check,
      iconClassName: "text-green-500",
      onClick: () => onReview(mod.id, "approve"),
    });
  }
  if (mod.status === "approved") {
    const blocked = hasRuledOutRequiredDependency(mod.dependencies);
    actions.push({
      label: blocked ? "Dependencies ruled out" : "Start Testing",
      icon: FlaskConical,
      iconClassName: "text-amber-400",
      disabled: blocked,
      onClick: () => onReview(mod.id, "start_testing"),
    });
  }
  if (mod.status === "testing") {
    const environment =
      envDisplay?.get(mod.project.id) ?? mod.project.environment;
    const unclassified = environment === "unspecified";
    actions.push({
      label: unclassified
        ? "Environment not specified"
        : "Approve for Next Update",
      icon: Check,
      iconClassName: "text-green-500",
      disabled: unclassified,
      onClick: () => onReview(mod.id, "approve"),
    });
  }
  if (mod.status === "testing" || mod.status === "next_update") {
    actions.push({
      label: "Send Back a Stage",
      icon: Undo2,
      onClick: () => onReview(mod.id, "send_back"),
    });
  }
  if (WORKSHOP_MOD_REVIEW_TARGETS[mod.status].reject) {
    actions.push(
      mod.status === "rejected"
        ? {
            label: "Edit Reason",
            icon: Pencil,
            onClick: () =>
              onReject({
                workshopModId: mod.id,
                name: mod.project.name,
                reason: mod.rejectReason,
                note: mod.rejectNote,
              }),
          }
        : {
            label: "Reject",
            icon: Ban,
            variant: "destructive",
            onClick: () =>
              onReject({ workshopModId: mod.id, name: mod.project.name }),
          },
    );
  }
  return actions;
}
