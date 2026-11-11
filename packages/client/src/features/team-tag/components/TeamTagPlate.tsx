import { useMemo } from "react";
import { PlateCanvas } from "./PlateCanvas";
import { usePlateAssets } from "../hooks/use-plate-assets";
import {
  parsePlateCode,
  PLATE_STRIP_HEIGHT,
  PLATE_STRIP_WIDTH,
} from "../plate";
import { useClipboard } from "@/hooks/use-clipboard";
import { cn } from "@/lib/utils";

export function TeamTagPlate({
  code,
  zoom = 2,
  className,
}: {
  code: string | null;
  zoom?: number;
  className?: string;
}) {
  const design = useMemo(() => parsePlateCode(code), [code]);
  const { assets } = usePlateAssets();
  const { copy } = useClipboard();

  if (!design || !code) return null;
  if (!assets) {
    return (
      <div
        aria-hidden
        className={cn("bg-muted", className)}
        style={{
          width: PLATE_STRIP_WIDTH * zoom,
          height: PLATE_STRIP_HEIGHT * zoom,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => void copy(code)}
      aria-label={`Copy the ${design.tag} design code`}
      className={cn("block cursor-pointer", className)}
    >
      <PlateCanvas design={design} assets={assets} zoom={zoom} bare />
    </button>
  );
}
