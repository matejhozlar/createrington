import { useEffect, useRef } from "react";
import type { PlateDesign } from "@createrington/shared/team-prefix";
import type { Bitmap, PlateAssets } from "../render/assets";
import { renderPlateStrip } from "../render/tab-list";
import { cn } from "@/lib/utils";

export function PlateCanvas({
  design,
  assets,
  zoom,
  name,
  nameColor,
  skin,
  className,
}: {
  design: PlateDesign;
  assets: PlateAssets;
  zoom: number;
  name?: string;
  nameColor?: number;
  skin?: Bitmap;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    renderPlateStrip(ref.current, {
      design,
      assets,
      zoom,
      name,
      nameColor,
      skin,
    });
  }, [design, assets, zoom, name, nameColor, skin]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={cn("block [image-rendering:pixelated]", className)}
    />
  );
}
