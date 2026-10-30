import { useMemo } from "react";
import {
  parseDesignCode,
  PLATE_WIDTH,
  type PlateDesign,
} from "@createrington/shared/team-tag";
import { PlateCanvas } from "@/features/team-tag/components/PlateCanvas";
import type { PlateAssets } from "@/features/team-tag/render/assets";

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

export function RenderTeamTag({
  code,
  assets,
  height,
  inline = false,
}: {
  code: string | null;
  assets: PlateAssets | null;
  height: number;
  inline?: boolean;
}) {
  const design = useMemo(() => parsePlate(code), [code]);
  if (!design || !assets) {
    return inline ? null : <div aria-hidden style={{ height }} />;
  }

  const zoom = Math.ceil(height / PLATE_ROWS);
  const scale = height / (PLATE_ROWS * zoom);

  return (
    <div
      className="relative shrink-0"
      style={{
        width: PLATE_COLUMNS * zoom * scale,
        height,
        top: inline ? (height * ROWS_BELOW_BASELINE) / PLATE_ROWS : 0,
      }}
    >
      <div className="origin-top-left" style={{ transform: `scale(${scale})` }}>
        <PlateCanvas
          design={design}
          assets={assets}
          zoom={zoom}
          bare
          className={scale === 1 ? undefined : "[image-rendering:auto]"}
        />
      </div>
    </div>
  );
}
