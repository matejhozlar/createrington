import { useState } from "react";
import { useStickyValue } from "@/hooks/use-sticky-value";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { WorkshopModStatus } from "@createrington/shared/db";
import {
  WORKSHOP_MOD_REVIEW_ACTION_LABELS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";

type ConfirmReviewAction = Exclude<WorkshopModReviewAction, "reject">;

export type ConfirmActionTarget =
  | {
      kind: "review";
      workshopModId: number;
      name: string;
      status: WorkshopModStatus;
      action: ConfirmReviewAction;
    }
  | { kind: "add"; projectId: number; name: string };

interface ConfirmCopy {
  title: (name: string) => string;
  description: string;
  variant?: "destructive";
}

const REVIEW_COPY: Partial<
  Record<WorkshopModStatus, Partial<Record<ConfirmReviewAction, ConfirmCopy>>>
> = {
  pending: {
    approve: {
      title: (name) => `Approve ${name}?`,
      description:
        "This accepts the suggestion into the pipeline. The mod moves to the Approved stage, shows as approved to players, and waits there until testing starts.",
    },
  },
  rejected: {
    approve: {
      title: (name) => `Approve ${name}?`,
      description:
        "This clears the rejection and its reason. The mod re-enters the pipeline at the Approved stage and waits there until testing starts.",
    },
  },
  approved: {
    start_testing: {
      title: (name) => `Start testing ${name}?`,
      description:
        "This moves the mod to the Testing stage to be tried out in the pack. From there it can be approved for the next update or sent back.",
    },
  },
  testing: {
    approve: {
      title: (name) => `Approve ${name} for the next update?`,
      description:
        "This marks testing as passed and queues the mod for the next release. It joins the pack's member list and ships when the next update is published.",
    },
    send_back: {
      title: (name) => `Send ${name} back a stage?`,
      description:
        "This returns the mod to the Approved stage, where it waits to be tested again.",
      variant: "destructive",
    },
  },
  next_update: {
    send_back: {
      title: (name) => `Send ${name} back a stage?`,
      description:
        "This pulls the mod out of the next update queue and returns it to the Testing stage. It leaves the pack's member list until it is approved again.",
      variant: "destructive",
    },
  },
};

const ADD_COPY: ConfirmCopy = {
  title: (name) => `Add ${name} to the workshop?`,
  description:
    "This adds the mod to the workshop as an approved suggestion credited to you, visible to players. It still goes through testing before it can join the pack.",
};

function copyFor(target: ConfirmActionTarget): ConfirmCopy {
  if (target.kind === "add") return ADD_COPY;
  const copy = REVIEW_COPY[target.status]?.[target.action];
  if (copy) return copy;
  const label = WORKSHOP_MOD_REVIEW_ACTION_LABELS[target.action];
  return {
    title: (name) =>
      `${label.charAt(0).toUpperCase()}${label.slice(1)} ${name}?`,
    description: "This moves the mod to a different stage of the pipeline.",
  };
}

export function ConfirmActionDialog({
  target,
  onOpenChange,
  onConfirm,
}: {
  target: ConfirmActionTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: ConfirmActionTarget, skipSession: boolean) => void;
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const displayTarget = useStickyValue(target);
  const copy = displayTarget ? copyFor(displayTarget) : null;

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {displayTarget && copy ? copy.title(displayTarget.name) : ""}
          </AlertDialogTitle>
          <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2">
          <Checkbox
            id="confirm-action-skip"
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <Label
            htmlFor="confirm-action-skip"
            className="font-normal text-muted-foreground"
          >
            Don&apos;t ask again for this session
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={copy?.variant}
            onClick={() => target && onConfirm(target, dontAskAgain)}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
