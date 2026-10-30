import { useMemo } from "react";
import { PlateCanvas } from "@/features/team-tag/components/PlateCanvas";
import { usePlateAssets } from "@/features/team-tag/hooks/use-plate-assets";
import {
  parsePlateCode,
  PLATE_STRIP_HEIGHT,
  PLATE_STRIP_WIDTH,
} from "@/features/team-tag/plate";
import { useToastActions } from "@/hooks/use-toast";
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
  const toast = useToastActions();

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

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <button
      type="button"
      onClick={copyCode}
      aria-label={`Copy the ${design.tag} design code`}
      className={cn("block cursor-pointer", className)}
    >
      <PlateCanvas design={design} assets={assets} zoom={zoom} bare />
    </button>
  );
}
