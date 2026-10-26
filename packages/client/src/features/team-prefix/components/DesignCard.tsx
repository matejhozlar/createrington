import { useId, useMemo } from "react";
import { ArrowLeftRight, Dices } from "lucide-react";
import {
  TAG_LENGTH,
  type PlateDesign,
} from "@createrington/shared/team-prefix";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabeledSwitch } from "@/components/labeled-switch";
import { cn } from "@/lib/utils";
import { PLATE_PRESETS } from "../presets";
import { randomColors } from "../random";
import { sanitizeTag, type PlateDraft } from "../hooks/use-plate-draft";
import type { Bitmap, PlateAssets } from "../render/assets";
import { ColorInput } from "./ColorInput";
import { PlateCanvas } from "./PlateCanvas";

const CLOSE_UP_ZOOM = 6;
const PRESET_ZOOM = 2;

const FADES = [
  {
    flag: "plateFadeOn",
    color: "plateFade",
    label: "Fade the plate",
    colorLabel: "Plate fade colour",
  },
  {
    flag: "letterFadeOn",
    color: "letterFade",
    label: "Fade the letters",
    colorLabel: "Letter fade colour",
  },
] as const;

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DesignCard({
  draft,
  design,
  assets,
  skin,
  onChange,
}: {
  draft: PlateDraft;
  design: PlateDesign;
  assets: PlateAssets | null;
  skin: Bitmap | undefined;
  onChange: (changes: Partial<PlateDraft>) => void;
}) {
  const tagId = useId();
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Design</CardTitle>
        <CardDescription>
          Riveted plate, the same width for every tag so names line up.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(randomColors(draft.tag))}
          >
            <Dices />
            Random
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex min-h-24 items-center justify-center overflow-x-auto rounded-lg border bg-[#1b1a1f] p-3">
          {assets && (
            <PlateCanvas
              design={design}
              assets={assets}
              zoom={CLOSE_UP_ZOOM}
              skin={skin}
            />
          )}
        </div>

        <Section title="Tag">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={tagId} className="sr-only">
              Tag
            </Label>
            <Input
              id={tagId}
              value={draft.tag}
              onChange={(event) =>
                onChange({ tag: sanitizeTag(event.target.value) })
              }
              maxLength={TAG_LENGTH}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={missing > 0}
              aria-describedby={`${tagId}-hint`}
              className="h-11 font-mono text-lg tracking-[0.3em] uppercase md:text-lg"
            />
            <p
              id={`${tagId}-hint`}
              className={cn(
                "text-xs",
                missing > 0 ? "text-amber-400" : "text-muted-foreground",
              )}
            >
              {missing > 0
                ? `${missing} more ${missing === 1 ? "character" : "characters"}: tags are exactly ${TAG_LENGTH} letters or digits.`
                : `Exactly ${TAG_LENGTH} letters or digits, shown in capitals.`}
            </p>
          </div>
        </Section>

        <Section
          title="Colours"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-my-1.5 h-7 text-muted-foreground"
              onClick={() =>
                onChange({ plate: draft.letters, letters: draft.plate })
              }
            >
              <ArrowLeftRight />
              Swap
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <ColorInput
              label="Plate"
              value={draft.plate}
              onChange={(plate) => onChange({ plate })}
            />
            <ColorInput
              label="Letters"
              value={draft.letters}
              onChange={(letters) => onChange({ letters })}
            />
          </div>
        </Section>

        <Section
          title="Fades"
          description="Optional. The plate fades from left to right, the letters from the first to the last."
        >
          <div className="flex flex-col gap-2.5">
            {FADES.map((fade) => (
              <div
                key={fade.flag}
                className="flex items-center justify-between gap-3"
              >
                <LabeledSwitch
                  id={`${tagId}-${fade.flag}`}
                  label={fade.label}
                  checked={draft[fade.flag]}
                  onCheckedChange={(checked) =>
                    onChange({ [fade.flag]: checked })
                  }
                  className="w-fit"
                />
                <ColorInput
                  label={fade.colorLabel}
                  hideLabel
                  value={draft[fade.color]}
                  disabled={!draft[fade.flag]}
                  onChange={(color) => onChange({ [fade.color]: color })}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Starting points">
          <div className="grid grid-cols-2 gap-2">
            {presetDesigns.map(({ preset, design: presetDesign }) => {
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
                    "flex cursor-pointer flex-col items-start gap-1.5 rounded-md border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between sm:gap-2",
                    active && "border-primary/60 bg-[var(--primary-glow)]",
                  )}
                >
                  <span className="truncate font-medium">{preset.name}</span>
                  {assets && (
                    <PlateCanvas
                      design={presetDesign}
                      assets={assets}
                      zoom={PRESET_ZOOM}
                      className="shrink-0 rounded-sm"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </Section>
      </CardContent>
    </Card>
  );
}
