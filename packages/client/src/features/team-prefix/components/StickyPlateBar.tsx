import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import type { PlateDesign } from "@createrington/shared/team-prefix";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Bitmap, PlateAssets } from "../render/assets";
import { PlateCanvas } from "./PlateCanvas";

const BAR_ZOOM = 2;

export function StickyPlateBar({
  design,
  assets,
  name,
  nameColor,
  skin,
  canCopy,
  onCopy,
}: {
  design: PlateDesign;
  assets: PlateAssets | null;
  name: string;
  nameColor: number;
  skin: Bitmap | undefined;
  canCopy: boolean;
  onCopy: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const hasAppBar = useIsMobile();

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!sentinel || !bar) return;
    const top = parseFloat(getComputedStyle(bar).top) || 0;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setStuck(
          !entry.isIntersecting &&
            entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0),
        ),
      { rootMargin: `-${top + 1}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasAppBar]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <div
        ref={barRef}
        className={cn(
          "sticky top-(--mobile-nav-height) z-20 -mt-px flex h-14 items-center justify-between gap-3 border-b px-5 transition-[background-color,border-color] duration-200",
          stuck
            ? "border-border bg-background/88 backdrop-blur-md"
            : "rounded-t-3xl border-transparent bg-transparent",
        )}
      >
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-[opacity,transform] duration-200",
            stuck ? "opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          {assets && (
            <PlateCanvas
              design={design}
              assets={assets}
              zoom={BAR_ZOOM}
              name={name}
              nameColor={nameColor}
              skin={skin ?? assets.steve}
              bare
            />
          )}
        </div>
        <Button type="button" size="sm" onClick={onCopy} disabled={!canCopy}>
          <Copy />
          Copy
        </Button>
      </div>
    </>
  );
}
