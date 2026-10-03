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

  const close = () => onIndexChange(null);

  const step = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < items.length) onIndexChange(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const ratio = aspectRatio(item);
  const widthLimits = ["100cqw", `100cqh * ${ratio}`];
  if (item.width) widthLimits.push(`${item.width}px`);

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{altText(item)}</DialogTitle>
        <DialogDescription className="sr-only">
          Screenshot {index + 1} of {items.length}
        </DialogDescription>

        <div
          onClick={handleStageClick}
          className="flex min-h-0 flex-1 items-center justify-center bg-black/50 p-2 [container-type:size] sm:p-6"
        >
          <div
            style={{
              aspectRatio: ratio,
              width: `min(${widthLimits.join(", ")})`,
              backgroundImage: `url("${item.images.thumb}")`,
            }}
            className="relative overflow-hidden rounded-lg bg-muted bg-contain bg-center bg-no-repeat shadow-lg"
          >
            <img
              key={item.id}
              src={item.images.full}
              alt={altText(item)}
              width={item.width ?? undefined}
              height={item.height ?? undefined}
              className="h-full w-full object-contain"
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
          </div>
        </div>

        <div className="max-h-[50dvh] shrink-0 overflow-y-auto border-t bg-background">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:px-6">
            {item.caption ? (
              <p className="text-sm text-foreground sm:text-base">
                {item.caption}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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
                  disabled={index === 0}
                  onClick={() => step(-1)}
                />
                <NavButton
                  side="right"
                  disabled={index === items.length - 1}
                  onClick={() => step(1)}
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
  onClick: () => void;
}

function NavButton({ side, disabled, onClick }: NavButtonProps) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={side === "left" ? "Previous screenshot" : "Next screenshot"}
      className="h-11 w-full sm:size-9"
    >
      <Icon className="size-5" />
    </Button>
  );
}
