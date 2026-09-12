import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const REWARD_MAX = 1_000_000;
const CAP_MAX = 100;

interface GallerySettings {
  rewardAmount: number;
  weeklyRewardCap: number;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const settingsQuery = trpc.admin.gallery.settings.get.useQuery(undefined, {
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Gallery rewards</DialogTitle>
          <DialogDescription>
            Paid to the submitter when a screenshot is approved. Saving reposts
            the rules notice in the submissions channel.
          </DialogDescription>
        </DialogHeader>
        {settingsQuery.data ? (
          <SettingsForm
            key={`${settingsQuery.data.rewardAmount}-${settingsQuery.data.weeklyRewardCap}`}
            settings={settingsQuery.data}
            onClose={() => onOpenChange(false)}
          />
        ) : settingsQuery.error ? (
          <p className="text-sm text-destructive">
            {settingsQuery.error.message}
          </p>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({
  settings,
  onClose,
}: {
  settings: GallerySettings;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [rewardAmount, setRewardAmount] = useState(
    String(settings.rewardAmount),
  );
  const [weeklyRewardCap, setWeeklyRewardCap] = useState(
    String(settings.weeklyRewardCap),
  );

  const updateMutation = trpc.admin.gallery.settings.update.useMutation(
    useMutationToast({
      success: "Gallery rewards saved",
      onSuccess: () => {
        utils.admin.gallery.settings.get.invalidate();
        utils.admin.gallery.get.invalidate();
        onClose();
      },
    }),
  );

  const parsedReward = Number.parseInt(rewardAmount, 10);
  const parsedCap = Number.parseInt(weeklyRewardCap, 10);
  const valid =
    Number.isInteger(parsedReward) &&
    parsedReward >= 0 &&
    parsedReward <= REWARD_MAX &&
    Number.isInteger(parsedCap) &&
    parsedCap >= 0 &&
    parsedCap <= CAP_MAX;
  const changed =
    parsedReward !== settings.rewardAmount ||
    parsedCap !== settings.weeklyRewardCap;

  return (
    <>
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="gallery-reward-amount">Reward amount</FieldLabel>
          <Input
            id="gallery-reward-amount"
            type="number"
            inputMode="numeric"
            min={0}
            max={REWARD_MAX}
            value={rewardAmount}
            onChange={(e) => setRewardAmount(e.target.value)}
          />
          <FieldDescription>
            Coins per approved screenshot. Set 0 to publish without paying.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="gallery-weekly-cap">Weekly cap</FieldLabel>
          <Input
            id="gallery-weekly-cap"
            type="number"
            inputMode="numeric"
            min={0}
            max={CAP_MAX}
            value={weeklyRewardCap}
            onChange={(e) => setWeeklyRewardCap(e.target.value)}
          />
          <FieldDescription>
            Rewarded approvals per player in a rolling 7 days. Approvals past
            the cap still publish but pay nothing.
          </FieldDescription>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!valid || !changed}
          loading={updateMutation.isPending}
          onClick={() =>
            updateMutation.mutate({
              rewardAmount: parsedReward,
              weeklyRewardCap: parsedCap,
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
