import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
import { designCode, type PlateDesign } from "@createrington/shared/team-tag";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth";
import { useToastActions } from "@/hooks/use-toast";
import { mcHeadsSkin } from "@/lib/external-urls";
import { cn } from "@/lib/utils";
import { ColoursStep } from "./components/ColoursStep";
import { HeroBackdrop } from "./components/HeroBackdrop";
import { PlateCloseUp } from "./components/PlateCloseUp";
import { PreviewSettings } from "./components/PreviewSettings";
import { PreviewStage, type StageMode } from "./components/PreviewStage";
import { SendStep } from "./components/SendStep";
import { StepActions } from "./components/StepActions";
import { StepHeader, type Step } from "./components/StepHeader";
import { StickyPlateBar } from "./components/StickyPlateBar";
import { TabListPreview } from "./components/TabListPreview";
import { TagStep } from "./components/TagStep";
import { RANKS } from "./presets";
import { useElementWidth } from "./hooks/use-element-width";
import { useLoadedImage } from "./hooks/use-loaded-image";
import { usePlateAssets } from "./hooks/use-plate-assets";
import {
  draftDesign,
  isCompleteDraft,
  usePlateDraft,
} from "./hooks/use-plate-draft";
import { usePreviewSettings } from "./hooks/use-preview-settings";
import { shareLink, useSharedDesign } from "./hooks/use-shared-design";
import { bitmapOf, type Bitmap } from "./render/assets";

const WIDE_LAYOUT = 1024;
const HEADER_OVERLAYS = [
  "bg-linear-to-t from-background from-[8%] to-transparent to-70%",
];
const ZOOMS = {
  wide: { plate: 10, line: 3 },
  narrow: { plate: 7, line: 2 },
} as const;

function readSkin(image: HTMLImageElement | null): Bitmap | undefined {
  if (!image) return undefined;
  try {
    return bitmapOf(image);
  } catch {
    return undefined;
  }
}

export function TeamTag() {
  const { user } = useAuth();
  const toast = useToastActions();
  const { assets, failed } = usePlateAssets();
  const { draft, update, load } = usePlateDraft();
  const { settings, update: updateSettings } = usePreviewSettings();
  const skinImage = useLoadedImage(
    user?.minecraftUuid ? mcHeadsSkin(user.minecraftUuid) : null,
  );
  const skin = useMemo(() => readSkin(skinImage), [skinImage]);
  const { ref: rootRef, width } = useElementWidth<HTMLDivElement>();
  const wide = width >= WIDE_LAYOUT;
  const zooms = wide ? ZOOMS.wide : ZOOMS.narrow;

  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [stageMode, setStageMode] = useState<StageMode>("close");

  const design = useMemo(() => draftDesign(draft), [draft]);
  const previewDesign = useDeferredValue(design);
  const complete = isCompleteDraft(draft);
  const code = complete ? designCode(design) : null;
  const name = user?.minecraftUsername ?? user?.username ?? "You";

  const goTo = useCallback(
    (next: Step) => {
      setStep(next);
      setStageMode(next === 3 ? "tab" : "close");
      if (!wide) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const panel = panelRef.current;
      if (panel && panel.getBoundingClientRect().top < 0) {
        panel.scrollIntoView({ block: "start" });
      }
    },
    [wide],
  );

  const loadAndSend = useCallback(
    (loaded: PlateDesign) => {
      load(loaded);
      goTo(3);
    },
    [load, goTo],
  );
  useSharedDesign(loadAndSend);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  };

  const copyCode = () => code && copy(code);

  const settingsFor = (layout: "row" | "list") => (
    <PreviewSettings
      settings={settings}
      onChange={updateSettings}
      layout={layout}
    />
  );

  return (
    <div ref={rootRef} className="flex flex-1 flex-col">
      {wide && (
        <header className="relative overflow-hidden px-8 pt-14 pb-10">
          <HeroBackdrop overlays={HEADER_OVERLAYS} />
          <div className="relative mx-auto max-w-7xl">
            <div className="flex max-w-160 flex-col gap-3">
              <h1 className="text-5xl/none font-bold tracking-tight text-foreground">
                Team tag
              </h1>
              <p className="text-lg text-pretty text-muted-foreground">
                Design the plate your party wears in the tab list, then hand the
                code to an admin with your Team Tag License.
              </p>
            </div>
          </div>
        </header>
      )}

      <div
        className={cn(
          wide
            ? "mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_420px] items-start gap-10 px-8 pt-2 pb-16"
            : "flex flex-1 flex-col",
        )}
      >
        <PreviewStage
          wide={wide}
          mode={stageMode}
          onModeChange={setStageMode}
          closeUp={
            assets ? (
              <PlateCloseUp
                design={design}
                assets={assets}
                name={name}
                nameColor={RANKS[settings.rank].color}
                skin={skin}
                plateZoom={zooms.plate}
                lineZoom={zooms.line}
              />
            ) : (
              <Skeleton className="mx-auto h-24 w-64" />
            )
          }
          tabList={
            <TabListPreview
              design={previewDesign}
              assets={assets}
              name={name}
              rank={settings.rank}
              skin={skin}
              guiScale={settings.guiScale}
              backdrop={settings.backdrop}
              logo={wide}
              fill={!wide}
              className={
                wide ? "relative" : "absolute inset-x-0 top-[62px] bottom-6"
              }
            />
          }
          settings={settingsFor("row")}
        />

        <div
          ref={panelRef}
          className={cn(
            "relative flex min-w-0 flex-col",
            !wide &&
              "z-10 -mt-6 flex-1 rounded-t-3xl border-t border-white/10 bg-background shadow-[0_-40px_120px_rgba(0,0,0,0.7)]",
          )}
        >
          {!wide && (
            <>
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
              />
              <StickyPlateBar
                design={design}
                assets={assets}
                name={name}
                nameColor={RANKS[settings.rank].color}
                skin={skin}
                canCopy={complete}
                onCopy={copyCode}
              />
            </>
          )}
          <div
            className={cn(
              "flex flex-col gap-6",
              wide ? "pt-2" : "mx-auto w-full max-w-160 flex-1 px-5 pt-2 pb-8",
            )}
          >
            {failed && (
              <p className="text-sm text-destructive">
                The plate images failed to load. Reload the page to try again.
              </p>
            )}
            <StepHeader
              step={step}
              wide={wide}
              locked={!complete}
              onStepChange={goTo}
            />
            {step === 1 && (
              <TagStep
                draft={draft}
                assets={assets}
                onChange={update}
                onLoad={loadAndSend}
              />
            )}
            {step === 2 && <ColoursStep draft={draft} onChange={update} />}
            {step === 3 && (
              <SendStep
                code={code}
                settings={wide ? null : settingsFor("list")}
                onCopyLink={() => code && copy(shareLink(code))}
              />
            )}
          </div>
          <StepActions
            step={step}
            wide={wide}
            locked={!complete}
            onBack={() => goTo(Math.max(1, step - 1) as Step)}
            onNext={() => goTo(Math.min(3, step + 1) as Step)}
            onCopy={copyCode}
          />
        </div>
      </div>
    </div>
  );
}
