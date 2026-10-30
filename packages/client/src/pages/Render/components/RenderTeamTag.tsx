import { useEffect, useMemo, useRef } from "react";
import {
  parseDesignCode,
  PLATE_WIDTH,
  type PlateDesign,
} from "@createrington/shared/team-tag";
import { usePlateAssets } from "@/features/team-tag/hooks/use-plate-assets";
import type { PlateAssets } from "@/features/team-tag/render/assets";
import {
  Framebuffer,
  sizeCanvas,
} from "@/features/team-tag/render/framebuffer";
import { plateOps } from "@/features/team-tag/render/text";

const PLATE_COLUMNS = PLATE_WIDTH + 1;
const PLATE_ROWS = 9;
const ROWS_BELOW_BASELINE = 2;

function parsePlate(code: string | null): PlateDesign | null {
  if (!code) return null;
  try {
    return parseDesignCode(code);
  } catch {
    return null;
  }
}

function drawPlate(
  canvas: HTMLCanvasElement,
  design: PlateDesign,
  assets: PlateAssets,
  height: number,
) {
  const fb = new Framebuffer(PLATE_COLUMNS, PLATE_ROWS);
  fb.text(plateOps(design, assets), 0, 0);

  const dpr = window.devicePixelRatio || 1;
  const ctx = sizeCanvas(
    canvas,
    (height * PLATE_COLUMNS) / PLATE_ROWS,
    height,
    dpr,
  );
  if (!ctx) return;

  const zoom = Math.ceil((height * dpr) / PLATE_ROWS);
  const crisp = document.createElement("canvas");
  crisp.width = PLATE_COLUMNS * zoom;
  crisp.height = PLATE_ROWS * zoom;
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
  const design = useMemo(() => parsePlate(code), [code]);
  const { assets } = usePlateAssets();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
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
      style={{ top: inline ? (height * ROWS_BELOW_BASELINE) / PLATE_ROWS : 0 }}
    />
  );
}
