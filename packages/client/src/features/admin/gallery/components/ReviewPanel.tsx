import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatMoney, formatRelativeDate } from "@/lib/format";
import { PlayerLabel } from "@/components/player-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  formatBytes,
  formatDimensions,
  GALLERY_STATUS_STYLES,
  type GalleryCredit,
  type GallerySubmissionDetail,
} from "../format";
import { CreditsPicker } from "./CreditsPicker";
import { RejectDialog } from "./RejectDialog";
import { SubmissionImage } from "./SubmissionImage";

const MAX_CAPTION_LENGTH = 500;

interface ReviewPanelProps {
  item: GallerySubmissionDetail;
  position: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onDecided: () => void;
}

export function ReviewPanel({
  item,
  position,
  total,
  onPrev,
  onNext,
  onDecided,
}: ReviewPanelProps) {
  const utils = trpc.useUtils();
  const [caption, setCaption] = useState(item.caption ?? "");
  const [reward, setReward] = useState(String(item.reward.defaultAmount));
  const [credits, setCredits] = useState<GalleryCredit[]>(item.credits);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectKey, setRejectKey] = useState(0);

  const invalidate = () => {
    utils.admin.gallery.list.invalidate();
    utils.admin.gallery.get.invalidate({ id: item.id });
  };

  const approveMutation = trpc.admin.gallery.approve.useMutation(
    useMutationToast({
      success: (result) =>
        result.capReached
          ? "Approved. The weekly cap is reached, so no reward was paid"
          : result.rewardPaid > 0
            ? `Approved. ${formatMoney(result.rewardPaid)} paid to ${item.author.minecraftUsername}`
            : "Approved without a reward",
      onSuccess: () => {
        invalidate();
        onDecided();
      },
    }),
  );

  const rejectMutation = trpc.admin.gallery.reject.useMutation(
    useMutationToast({
      success: "Submission rejected",
      onSuccess: () => {
        invalidate();
        onDecided();
      },
    }),
  );

  const parsedReward = Number.parseInt(reward, 10);
  const rewardValid = Number.isInteger(parsedReward) && parsedReward >= 0;
  const busy = approveMutation.isPending || rejectMutation.isPending;
  const { capReached, weeklyUsed, weeklyCap } = item.reward;
  const dimensions = formatDimensions(item.width, item.height);
  const submittedAt = new Date(item.createdAt);

  const approve = () => {
    approveMutation.mutate({
      id: item.id,
      caption: caption.trim() || null,
      rewardAmount: parsedReward,
      creditPlayerUuids: credits.map((credit) => credit.minecraftUuid),
    });
  };

  const openReject = () => {
    setRejectKey((key) => key + 1);
    setRejectOpen(true);
  };

  return (
    <>
      <Card className="gap-0 overflow-hidden">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b">
          <div className="flex items-center gap-3">
            <CardTitle>
              Reviewing {position} of {total}
            </CardTitle>
            <Badge
              variant="outline"
              className={GALLERY_STATUS_STYLES.pending.className}
            >
              {GALLERY_STATUS_STYLES.pending.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous submission"
              disabled={position <= 1 || busy}
              onClick={onPrev}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next submission"
              disabled={position >= total || busy}
              onClick={onNext}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <SubmissionImage
              source={item.originalUrl}
              alt={
                item.caption ?? `Screenshot by ${item.author.minecraftUsername}`
              }
            />
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <PlayerLabel
                uuid={item.author.minecraftUuid}
                name={item.author.minecraftUsername}
              />
              <span title={submittedAt.toLocaleString()}>
                Submitted {formatRelativeDate(submittedAt)}
              </span>
              {dimensions && <span>{dimensions}</span>}
              <span>{formatBytes(item.originalBytes)}</span>
              <span className="uppercase">
                {item.originalContentType.split("/")[1]}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="gallery-caption">Caption</FieldLabel>
              <textarea
                id="gallery-caption"
                value={caption}
                maxLength={MAX_CAPTION_LENGTH}
                rows={3}
                placeholder="What are we looking at?"
                disabled={busy}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <FieldDescription>
                Prefilled from the Discord message. Shown on the website and in
                the announcement.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="gallery-reward">Reward</FieldLabel>
              <div className="relative">
                <Coins className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="gallery-reward"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={capReached ? "0" : reward}
                  disabled={busy || capReached}
                  onChange={(e) => setReward(e.target.value)}
                  className="pl-9"
                />
              </div>
              {capReached ? (
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Weekly cap reached: {weeklyUsed} of {weeklyCap} rewarded
                    approvals in the last 7 days. Approving publishes without
                    paying.
                  </span>
                </div>
              ) : (
                <FieldDescription>
                  {weeklyUsed} of {weeklyCap} weekly rewards used by this
                  player. Set 0 to publish without paying.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel>Also featuring</FieldLabel>
              <CreditsPicker
                value={credits}
                onChange={setCredits}
                excludeUuid={item.author.minecraftUuid}
                disabled={busy}
              />
              <FieldDescription>
                Other builders shown in the screenshot get display credit, the
                reward goes to the submitter.
              </FieldDescription>
            </Field>

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <Button
                variant="success"
                size="lg"
                loading={approveMutation.isPending}
                disabled={busy || !rewardValid}
                onClick={approve}
              >
                <Check className="mr-2 size-4" />
                Approve and publish
              </Button>
              <Button
                variant="destructive"
                size="lg"
                disabled={busy}
                onClick={openReject}
              >
                <X className="mr-2 size-4" />
                Reject
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <RejectDialog
        key={rejectKey}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        authorName={item.author.minecraftUsername}
        onConfirm={(note) =>
          rejectMutation.mutateAsync({
            id: item.id,
            note: note.trim() || undefined,
          })
        }
      />
    </>
  );
}
