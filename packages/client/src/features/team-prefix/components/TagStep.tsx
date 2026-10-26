import { useMemo } from "react";
import {
  TAG_LENGTH,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import { cn } from "@/lib/utils";
import { PLATE_PRESETS } from "../presets";
import type { PlateDraft } from "../hooks/use-plate-draft";
import type { PlateAssets } from "../render/assets";
import { LoadCodeCard } from "./LoadCodeCard";
import { PlateCanvas } from "./PlateCanvas";
import { SectionLabel } from "./SectionLabel";
import { TagCells } from "./TagCells";

const PRESET_ZOOM = 2;

export function TagStep({
  draft,
  assets,
  onChange,
  onLoad,
}: {
  draft: PlateDraft;
  assets: PlateAssets | null;
  onChange: (changes: Partial<PlateDraft>) => void;
  onLoad: (design: PlateDesign) => void;
}) {
  const presetDesigns = useMemo(
    () =>
      PLATE_PRESETS.map((preset) => ({
        preset,
        design: {
          style: "riveted",
          tag: draft.tag,
          plate: preset.plate,
          letters: preset.letters,
          plateFade: null,
          letterFade: null,
        } satisfies PlateDesign,
      })),
    [draft.tag],
  );
  const missing = TAG_LENGTH - draft.tag.length;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2.5">
        <TagCells tag={draft.tag} onChange={(tag) => onChange({ tag })} />
        {missing > 0 && (
          <p className="text-xs text-amber-400">
            {missing} more {missing === 1 ? "character" : "characters"}: tags
            are exactly {TAG_LENGTH} letters or digits.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Starting points</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {presetDesigns.map(({ preset, design }) => {
            const active =
              draft.plate === preset.plate &&
              draft.letters === preset.letters &&
              !draft.plateFadeOn &&
              !draft.letterFadeOn;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() =>
                  onChange({
                    plate: preset.plate,
                    letters: preset.letters,
                    plateFadeOn: false,
                    letterFadeOn: false,
                  })
                }
                aria-pressed={active}
                className={cn(
                  "flex min-h-16 min-w-0 cursor-pointer flex-col items-start gap-2 rounded-[10px] border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40",
                  active && "border-primary/60 bg-(--primary-glow)",
                )}
              >
                <span className="text-sm font-medium">{preset.name}</span>
                {assets && (
                  <PlateCanvas
                    design={design}
                    assets={assets}
                    zoom={PRESET_ZOOM}
                    className="shrink-0 rounded-sm"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <LoadCodeCard onLoad={onLoad} />
    </div>
  );
}
