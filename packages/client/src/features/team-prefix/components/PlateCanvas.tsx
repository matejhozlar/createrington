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
  bare,
  label,
  className,
}: {
  design: PlateDesign;
  assets: PlateAssets;
  zoom: number;
  name?: string;
  nameColor?: number;
  skin?: Bitmap;
  bare?: boolean;
  label?: string;
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
      bare,
    });
  }, [design, assets, zoom, name, nameColor, skin, bare]);

  return (
    <canvas
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block [image-rendering:pixelated]", className)}
    />
  );
}
