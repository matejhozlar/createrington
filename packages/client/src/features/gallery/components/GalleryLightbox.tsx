import type { KeyboardEvent, MouseEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerLabel } from "@/components/player-label";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/format";
import { aspectRatio, altText, creditName, type GalleryItem } from "../format";
import type { LightboxDirection } from "../hooks/use-gallery-lightbox";

interface GalleryLightboxProps {
  item: GalleryItem | null;
  position: number;
  total: number;
  hasPrevious: boolean;
  hasNext: boolean;
  turning: LightboxDirection | null;
  onStep: (direction: LightboxDirection) => void;
  onClose: () => void;
}

export function GalleryLightbox({
  item,
  position,
  total,
  hasPrevious,
  hasNext,
  turning,
  onStep,
  onClose,
}: GalleryLightboxProps) {
  if (!item) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") onStep(-1);
    if (event.key === "ArrowRight") onStep(1);
  };

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const ratio = aspectRatio(item);
  const widthLimits = ["100cqw", `100cqh * ${ratio}`];
  if (item.width) widthLimits.push(`${item.width}px`);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{altText(item)}</DialogTitle>
        <DialogDescription className="sr-only">
          Screenshot {position} of {total}
        </DialogDescription>

        <div
          onClick={handleStageClick}
          className="relative flex min-h-0 flex-1 items-center justify-center bg-black/50 p-2 [container-type:size] sm:p-6"
        >
          <div
            style={{
              aspectRatio: ratio,
              width: `min(${widthLimits.join(", ")})`,
              backgroundImage: `url("${item.images.thumb}")`,
            }}
            className="overflow-hidden rounded-lg bg-muted bg-contain bg-center bg-no-repeat shadow-lg"
          >
            <img
              key={item.id}
              src={item.images.full}
              alt={altText(item)}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              className="h-full w-full object-contain"
            />
          </div>

          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Close"
              className="absolute right-2 top-2 rounded-full opacity-80 shadow-md hover:opacity-100 sm:right-3 sm:top-3"
            >
              <X className="size-5" />
            </Button>
          </DialogClose>
        </div>

        <div className="max-h-[50dvh] shrink-0 overflow-y-auto border-t bg-background">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:px-6">
            {item.caption ? (
              <p className="text-sm text-foreground sm:text-base">
                {item.caption}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground sm:min-h-9">
                <PlayerLabel
                  uuid={item.author.minecraftUuid}
                  name={creditName(item.author)}
                  size={24}
                />
                {item.credits.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>with</span>
                    {item.credits.map((credit) => (
                      <PlayerLabel
                        key={credit.minecraftUuid}
                        uuid={credit.minecraftUuid}
                        name={creditName(credit)}
                        size={20}
                      />
                    ))}
                  </span>
                ) : null}
                {item.publishedAt ? (
                  <span className="ml-auto shrink-0">
                    {formatRelativeDate(item.publishedAt)}
                  </span>
                ) : null}
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
                <NavButton
                  side="left"
                  disabled={!hasPrevious || turning !== null}
                  loading={turning === -1}
                  onClick={() => onStep(-1)}
                />
                <NavButton
                  side="right"
                  disabled={!hasNext || turning !== null}
                  loading={turning === 1}
                  onClick={() => onStep(1)}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface NavButtonProps {
  side: "left" | "right";
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}

function NavButton({ side, disabled, loading, onClick }: NavButtonProps) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={disabled}
      loading={loading}
      onClick={onClick}
      aria-label={side === "left" ? "Previous screenshot" : "Next screenshot"}
      className="h-11 w-full sm:size-9"
    >
      <Icon className="size-5" />
    </Button>
  );
}
