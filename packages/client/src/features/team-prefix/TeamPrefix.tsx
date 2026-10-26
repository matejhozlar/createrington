import { useCallback, useDeferredValue, useMemo } from "react";
import { designCode } from "@createrington/shared/team-prefix";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/contexts/auth";
import { mcHeadsSkin } from "@/lib/external-urls";
import { CodeCard } from "./components/CodeCard";
import { DesignCard } from "./components/DesignCard";
import { TabListPreview } from "./components/TabListPreview";
import type { Backdrop, GuiScale } from "./presets";
import { useLoadedImage } from "./hooks/use-loaded-image";
import { usePlateAssets } from "./hooks/use-plate-assets";
import {
  draftDesign,
  isCompleteDraft,
  usePlateDraft,
} from "./hooks/use-plate-draft";
import { usePreviewSettings } from "./hooks/use-preview-settings";
import { bitmapOf, type Bitmap } from "./render/assets";

function readSkin(image: HTMLImageElement | null): Bitmap | undefined {
  if (!image) return undefined;
  try {
    return bitmapOf(image);
  } catch {
    return undefined;
  }
}

export function TeamPrefix() {
  const { user } = useAuth();
  const { assets, failed } = usePlateAssets();
  const { draft, update, load } = usePlateDraft();
  const { settings, update: updateSettings } = usePreviewSettings();
  const skinImage = useLoadedImage(
    user?.minecraftUuid ? mcHeadsSkin(user.minecraftUuid) : null,
  );
  const skin = useMemo(() => readSkin(skinImage), [skinImage]);

  const design = useMemo(() => draftDesign(draft), [draft]);
  const previewDesign = useDeferredValue(design);
  const code = isCompleteDraft(draft) ? designCode(design) : null;
  const name = user?.minecraftUsername ?? user?.username ?? "You";
  const setRank = useCallback(
    (rank: number) => updateSettings({ rank }),
    [updateSettings],
  );
  const setGuiScale = useCallback(
    (guiScale: GuiScale) => updateSettings({ guiScale }),
    [updateSettings],
  );
  const setBackdrop = useCallback(
    (backdrop: Backdrop) => updateSettings({ backdrop }),
    [updateSettings],
  );

  return (
    <div>
      <PageHeader
        title="Team prefix"
        description="Design the plate your party wears in the tab list, then send the code to an admin with your Team Prefix License."
        imageSrc="/assets/hero/mountains-train-station.webp"
      />

      <section className="px-5 pb-16 md:px-8">
        {failed && (
          <p className="mx-auto mb-6 max-w-7xl text-sm text-destructive">
            The plate images failed to load. Reload the page to try again.
          </p>
        )}
        <div className="mx-auto grid max-w-7xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <TabListPreview
              design={previewDesign}
              assets={assets}
              name={name}
              rank={settings.rank}
              skin={skin}
              guiScale={settings.guiScale}
              backdrop={settings.backdrop}
              onRankChange={setRank}
              onGuiScaleChange={setGuiScale}
              onBackdropChange={setBackdrop}
            />
          </div>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <DesignCard
              draft={draft}
              design={design}
              assets={assets}
              skin={skin}
              onChange={update}
            />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <CodeCard code={code} onLoad={load} />
          </div>
        </div>
      </section>
    </div>
  );
}
