import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";
import type { WorkshopModStatus } from "@createrington/shared/db";
import { sessionStore } from "@/lib/storage";
import { trpc, type RouterInput } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import type { ConfirmActionTarget } from "@/features/admin/workshop/workshop-admin-detail/components/ConfirmActionDialog";
import type {
  AdminWorkshopMod,
  RejectTarget,
} from "@/features/admin/workshop/workshop-admin-detail/types";

type RejectInput = Omit<
  RouterInput["admin"]["workshops"]["reviewMod"],
  "action"
>;

const REVIEW_TOASTS: Partial<Record<WorkshopModStatus, string>> = {
  approved: "Mod approved",
  testing: "Mod moved to testing",
  next_update: "Mod approved, coming next update",
  rejected: "Mod rejected",
};

const SEND_BACK_TOASTS: Partial<Record<WorkshopModStatus, string>> = {
  approved: "Mod sent back, awaiting testing",
  testing: "Mod sent back to testing",
};

const SKIP_CONFIRM_SESSION_KEY = "workshop-admin-skip-confirms";

export function useWorkshopReview({
  workshopId,
  mods,
  onChanged,
}: {
  workshopId: number;
  mods: AdminWorkshopMod[];
  onChanged: () => Promise<unknown>;
}) {
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [confirmTarget, setConfirmTarget] =
    useState<ConfirmActionTarget | null>(null);
  const [skipConfirms, setSkipConfirms] = useState(
    () => sessionStore.get(SKIP_CONFIRM_SESSION_KEY) === "1",
  );

  const reviewMutation = useMutation(
    trpc.admin.workshops.reviewMod.mutationOptions(
      useMutationToast({
        success: (mod, variables) => {
          const toasts =
            variables.action === "send_back" ? SEND_BACK_TOASTS : REVIEW_TOASTS;
          return toasts[mod.status] ?? "Mod updated";
        },
        onSuccess: () => {
          setRejectTarget(null);
          void onChanged();
        },
        onError: () => {
          void onChanged();
        },
      }),
    ),
  );

  const addProjectMutation = useMutation(
    trpc.admin.workshops.addMods.mutationOptions(
      useMutationToast({
        success: "Added to the workshop as approved",
        onSuccess: () => {
          void onChanged();
        },
      }),
    ),
  );

  const review = (
    id: number,
    action: Exclude<WorkshopModReviewAction, "reject">,
  ) => {
    const mod = mods.find((row) => row.id === id);
    if (!mod) return;
    if (skipConfirms) {
      reviewMutation.mutate({ workshopModId: id, action });
      return;
    }
    setConfirmTarget({
      kind: "review",
      workshopModId: id,
      name: mod.project.name,
      status: mod.status,
      action,
    });
  };

  const addProject = (projectId: number, name: string) => {
    if (skipConfirms) {
      addProjectMutation.mutate({ workshopId, projectIds: [projectId] });
      return;
    }
    setConfirmTarget({ kind: "add", projectId, name });
  };

  const confirm = (target: ConfirmActionTarget, skipSession: boolean) => {
    if (target.kind === "add") {
      addProjectMutation.mutate({ workshopId, projectIds: [target.projectId] });
    } else {
      reviewMutation.mutate({
        workshopModId: target.workshopModId,
        action: target.action,
      });
    }
    if (skipSession) {
      setSkipConfirms(true);
      sessionStore.set(SKIP_CONFIRM_SESSION_KEY, "1");
    }
  };

  const reject = (input: RejectInput) =>
    reviewMutation.mutate({ ...input, action: "reject" });

  return {
    review,
    addProject,
    confirm,
    confirmTarget,
    closeConfirm: () => setConfirmTarget(null),
    reject,
    rejectTarget,
    openReject: setRejectTarget,
    closeReject: () => setRejectTarget(null),
    rejectPending: reviewMutation.isPending,
    busyModId: reviewMutation.isPending
      ? (reviewMutation.variables?.workshopModId ?? null)
      : null,
    busyProjectId: addProjectMutation.isPending
      ? (addProjectMutation.variables?.projectIds[0] ?? null)
      : null,
  };
}
