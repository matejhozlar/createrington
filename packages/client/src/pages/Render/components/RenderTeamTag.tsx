import { useLayoutEffect, useMemo, useRef } from "react";
import type { PlateDesign } from "@createrington/shared/team-tag";
import { usePlateAssets } from "@/features/team-tag/hooks/use-plate-assets";
import {
  parsePlateCode,
  PLATE_STRIP_HEIGHT,
  PLATE_STRIP_WIDTH,
} from "@/features/team-tag/plate";
import type { PlateAssets } from "@/features/team-tag/render/assets";
import {
  Framebuffer,
  sizeCanvas,
} from "@/features/team-tag/render/framebuffer";
import { plateOps } from "@/features/team-tag/render/text";

const ROWS_BELOW_BASELINE = 2;

function drawPlate(
  canvas: HTMLCanvasElement,
  design: PlateDesign,
  assets: PlateAssets,
  height: number,
) {
  const fb = new Framebuffer(PLATE_STRIP_WIDTH, PLATE_STRIP_HEIGHT);
  fb.text(plateOps(design, assets), 0, 0);

  const dpr = window.devicePixelRatio || 1;
  const ctx = sizeCanvas(
    canvas,
    (height * PLATE_STRIP_WIDTH) / PLATE_STRIP_HEIGHT,
    height,
    dpr,
  );
  if (!ctx) return;

  const zoom = Math.ceil((height * dpr) / PLATE_STRIP_HEIGHT);
  const crisp = document.createElement("canvas");
  crisp.width = PLATE_STRIP_WIDTH * zoom;
  crisp.height = PLATE_STRIP_HEIGHT * zoom;
  const crispCtx = crisp.getContext("2d");
  if (!crispCtx) return;
  crispCtx.imageSmoothingEnabled = false;
  crispCtx.drawImage(fb.toCanvas(), 0, 0, crisp.width, crisp.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(crisp, 0, 0, canvas.width, canvas.height);
}

export function RenderTeamTag({
  code,
  height,
  inline = false,
}: {
  code: string | null;
  height: number;
  inline?: boolean;
}) {
  const design = useMemo(() => parsePlateCode(code), [code]);
  const { assets } = usePlateAssets();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (ref.current && design && assets) {
      drawPlate(ref.current, design, assets, height);
    }
  }, [design, assets, height]);

  if (!design || !assets) {
    return inline ? null : <div aria-hidden style={{ height }} />;
  }

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="relative block shrink-0"
      style={{
        top: inline ? (height * ROWS_BELOW_BASELINE) / PLATE_STRIP_HEIGHT : 0,
      }}
    />
  );
}
