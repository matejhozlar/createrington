import type { KeyboardEvent } from "react";
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
import { aspectRatio, altText, creditName, type GalleryItem } from "../types";

interface GalleryLightboxProps {
  items: GalleryItem[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

export function GalleryLightbox({
  items,
  index,
  onIndexChange,
}: GalleryLightboxProps) {
  const item = index === null ? undefined : items[index];
  if (index === null || !item) return null;

  const step = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < items.length) onIndexChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        onKeyDown={handleKeyDown}
        showCloseButton={false}
        className="max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">{altText(item)}</DialogTitle>
        <DialogDescription className="sr-only">
          Screenshot {index + 1} of {items.length}
        </DialogDescription>

        <div className="relative bg-black/60">
          <img
            src={item.images.full}
            alt={altText(item)}
            width={item.width ?? undefined}
            height={item.height ?? undefined}
            style={{ aspectRatio: aspectRatio(item) }}
            className="mx-auto max-h-[70vh] w-full object-contain"
          />

          <DialogClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Close"
              className="absolute right-2 top-2 rounded-full opacity-80 hover:opacity-100 sm:right-3 sm:top-3"
            >
              <X className="size-5" />
            </Button>
          </DialogClose>

          <NavButton
            side="left"
            disabled={index === 0}
            onClick={() => step(-1)}
          />
          <NavButton
            side="right"
            disabled={index === items.length - 1}
            onClick={() => step(1)}
          />
        </div>

        <div className="space-y-3 p-4 sm:p-6">
          {item.caption ? (
            <p className="text-sm text-foreground sm:text-base">
              {item.caption}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface NavButtonProps {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}

function NavButton({ side, disabled, onClick }: NavButtonProps) {
  if (disabled) return null;

  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={onClick}
      aria-label={side === "left" ? "Previous screenshot" : "Next screenshot"}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 ${
        side === "left" ? "left-2 sm:left-3" : "right-2 sm:right-3"
      }`}
    >
      <Icon className="size-5" />
    </Button>
  );
}
