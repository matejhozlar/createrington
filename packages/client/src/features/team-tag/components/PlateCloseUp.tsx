import type { PlateDesign } from "@createrington/shared/team-tag";
import type { Bitmap, PlateAssets } from "../render/assets";
import { PlateCanvas } from "./PlateCanvas";

export function PlateCloseUp({
  design,
  assets,
  name,
  nameColor,
  head,
  plateZoom,
  lineZoom,
}: {
  design: PlateDesign;
  assets: PlateAssets;
  name: string;
  nameColor: number;
  head: Bitmap | undefined;
  plateZoom: number;
  lineZoom: number;
}) {
  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -bottom-0.5 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/70 blur-[8px]"
        />
        <PlateCanvas
          design={design}
          assets={assets}
          zoom={plateZoom}
          bare
          label={`Your ${design.tag} plate`}
          className="relative"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-full h-6 -scale-y-100 overflow-hidden opacity-[0.18] blur-[1px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]"
        >
          <PlateCanvas
            design={design}
            assets={assets}
            zoom={plateZoom}
            bare
            className="absolute bottom-0 left-0"
          />
        </div>
      </div>
      <div
        aria-hidden
        className="mt-7 h-px w-[calc(100%-40px)] bg-linear-to-r from-transparent via-white/15 to-transparent"
      />
      <PlateCanvas
        design={design}
        assets={assets}
        zoom={lineZoom}
        name={name}
        nameColor={nameColor}
        head={head ?? assets.steveHead}
        bare
        className="mt-4"
      />
    </div>
  );
}
