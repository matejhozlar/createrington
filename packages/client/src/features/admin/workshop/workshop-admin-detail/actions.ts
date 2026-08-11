import { Ban, Check, FlaskConical, Pencil, Undo2 } from "lucide-react";
import type { DataTableAction } from "@/components/data-table";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";
import type { AdminWorkshopMod } from "./types";

export interface ModReviewHandlers {
  onReview: (workshopModId: number, action: WorkshopModReviewAction) => void;
  onReject: (target: { workshopModId: number; name: string }) => void;
}

export function modReviewActions(
  mod: AdminWorkshopMod,
  { onReview, onReject }: ModReviewHandlers,
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
    actions.push({
      label: "Start Testing",
      icon: FlaskConical,
      iconClassName: "text-amber-400",
      onClick: () => onReview(mod.id, "start_testing"),
    });
  }
  if (mod.status === "testing") {
    actions.push({
      label: "Approve for Next Update",
      icon: Check,
      iconClassName: "text-green-500",
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
  if (mod.status === "rejected") {
    actions.push({
      label: "Edit Reason",
      icon: Pencil,
      onClick: () =>
        onReject({ workshopModId: mod.id, name: mod.project.name }),
    });
  } else {
    actions.push({
      label: "Reject",
      icon: Ban,
      variant: "destructive",
      onClick: () =>
        onReject({ workshopModId: mod.id, name: mod.project.name }),
    });
  }
  return actions;
}
