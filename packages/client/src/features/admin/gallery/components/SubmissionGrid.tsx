import { useState } from "react";
import { Coins, ExternalLink, ImageOff, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { formatMoney, formatRelativeDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Paginator } from "@/components/paginator";
import { PlayerLabel } from "@/components/player-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GALLERY_STATUS_STYLES,
  type GalleryStatus,
  type GallerySubmissionItem,
} from "../format";

const PAGE_SIZE = 24;
const SKELETON_COUNT = 6;

const EMPTY_COPY: Record<Exclude<GalleryStatus, "pending">, string> = {
  approved: "Nothing published yet. Approved screenshots show up here.",
  rejected: "No rejected screenshots.",
  withdrawn:
    "Nothing withdrawn. Deleted posts and removed screenshots land here.",
};

interface SubmissionGridProps {
  status: Exclude<GalleryStatus, "pending">;
}

export function SubmissionGrid({ status }: SubmissionGridProps) {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(0);
  const [removeTarget, setRemoveTarget] =
    useState<GallerySubmissionItem | null>(null);
  const displayRemoveTarget = useStickyValue(removeTarget);

  const listQuery = trpc.admin.gallery.list.useQuery({
    status,
    page,
    limit: PAGE_SIZE,
  });

  const removeMutation = trpc.admin.gallery.remove.useMutation(
    useMutationToast({
      success: "Screenshot removed from the gallery",
      onSuccess: () => {
        utils.admin.gallery.list.invalidate();
        setRemoveTarget(null);
      },
    }),
  );

  if (listQuery.error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-destructive">{listQuery.error.message}</p>
            <Button
              onClick={() => listQuery.refetch()}
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  if (!listQuery.isLoading && items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <ImageOff className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">{EMPTY_COPY[status]}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {listQuery.isLoading
          ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <Card key={index} className="gap-0 overflow-hidden py-0">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))
          : items.map((item) => (
              <SubmissionCard
                key={item.id}
                item={item}
                onRemove={
                  status === "approved"
                    ? () => setRemoveTarget(item)
                    : undefined
                }
              />
            ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Paginator
          page={pagination.page}
          limit={pagination.limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={setPage}
          itemLabel="screenshot"
        />
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title="Remove from the gallery?"
        description={
          displayRemoveTarget
            ? `The screenshot by ${displayRemoveTarget.author.minecraftUsername} disappears from the website and its announcement is deleted. The reward already paid is kept.`
            : undefined
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() =>
          displayRemoveTarget
            ? removeMutation.mutateAsync({ id: displayRemoveTarget.id })
            : undefined
        }
      />
    </div>
  );
}

function SubmissionCard({
  item,
  onRemove,
}: {
  item: GallerySubmissionItem;
  onRemove?: () => void;
}) {
  const style = GALLERY_STATUS_STYLES[item.status];
  const reviewedAt = item.reviewedAt ? new Date(item.reviewedAt) : null;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative flex aspect-video items-center justify-center bg-black/40">
        {item.images ? (
          <img
            src={item.images.thumb}
            alt={
              item.caption ?? `Screenshot by ${item.author.minecraftUsername}`
            }
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <ImageOff className="size-8 text-muted-foreground" />
        )}
        <Badge
          variant="outline"
          className={`absolute left-3 top-3 bg-background/80 backdrop-blur ${style.className}`}
        >
          {style.label}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="line-clamp-2 min-h-10 text-sm">
          {item.caption ?? (
            <span className="italic text-muted-foreground">No caption</span>
          )}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <PlayerLabel
            uuid={item.author.minecraftUuid}
            name={item.author.minecraftUsername}
          />
          {item.rewardAmount !== null && item.rewardAmount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Coins className="size-3.5" />
              {formatMoney(item.rewardAmount)}
            </span>
          )}
        </div>

        {item.credits.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also featuring{" "}
            {item.credits.map((credit) => credit.minecraftUsername).join(", ")}
          </p>
        )}

        {item.rejectNote && (
          <p className="text-xs text-muted-foreground">
            Note: {item.rejectNote}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span title={reviewedAt?.toLocaleString()}>
            {reviewedAt
              ? `Reviewed ${formatRelativeDate(reviewedAt)}`
              : `Submitted ${formatRelativeDate(new Date(item.createdAt))}`}
          </span>
          <div className="flex items-center gap-1">
            {item.announcementUrl && (
              <Button asChild variant="ghost" size="xs">
                <a href={item.announcementUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3" />
                  Announcement
                </a>
              </Button>
            )}
            {onRemove && (
              <Button
                variant="ghost"
                size="xs"
                className="text-destructive hover:text-destructive"
                onClick={onRemove}
              >
                <Trash2 className="size-3" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
