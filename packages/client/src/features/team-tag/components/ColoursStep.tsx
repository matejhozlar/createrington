import { useId } from "react";
import { ArrowLeftRight, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { randomColors, readsClearly } from "../random";
import type { PlateDraft } from "../hooks/use-plate-draft";
import { ColorInput } from "./ColorInput";
import { SectionLabel } from "./SectionLabel";

const FADES = [
  {
    flag: "plateFadeOn",
    color: "plateFade",
    label: "Fade the plate",
    hint: "Left to right",
    colorLabel: "Plate fade",
  },
  {
    flag: "letterFadeOn",
    color: "letterFade",
    label: "Fade the letters",
    hint: "First letter to last",
    colorLabel: "Letter fade",
  },
] as const;

export function ColoursStep({
  draft,
  onChange,
}: {
  draft: PlateDraft;
  onChange: (changes: Partial<PlateDraft>) => void;
}) {
  const id = useId();
  const readable = readsClearly(draft.plate, draft.letters);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex min-h-8 items-center justify-between gap-3">
          <SectionLabel>Colours</SectionLabel>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({ plate: draft.letters, letters: draft.plate })
              }
            >
              <ArrowLeftRight />
              Swap
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(randomColors(draft.tag))}
            >
              <Dices />
              Random
            </Button>
          </div>
        </div>
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          <ColorInput
            label="Plate"
            value={draft.plate}
            onChange={(plate) => onChange({ plate })}
            className="min-h-16 py-3"
          >
            <span className="text-sm font-medium">Plate</span>
            <span className="text-xs text-muted-foreground">
              Tap the swatch to pick
            </span>
          </ColorInput>
          <ColorInput
            label="Letters"
            value={draft.letters}
            onChange={(letters) => onChange({ letters })}
            className="min-h-16 py-3"
          >
            <span className="text-sm font-medium">Letters</span>
            <span
              className={cn(
                "text-xs",
                readable ? "text-muted-foreground" : "text-amber-400",
              )}
            >
              {readable
                ? "Reads clearly on the plate"
                : "Hard to read on this plate"}
            </span>
          </ColorInput>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Fades · optional</SectionLabel>
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {FADES.map((fade) => (
            <div key={fade.flag}>
              <label
                htmlFor={`${id}-${fade.flag}`}
                className="flex min-h-[60px] cursor-pointer items-center gap-3.5 px-3.5 py-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">{fade.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {fade.hint}
                  </span>
                </span>
                <Switch
                  id={`${id}-${fade.flag}`}
                  checked={draft[fade.flag]}
                  onCheckedChange={(checked) =>
                    onChange({ [fade.flag]: checked })
                  }
                />
              </label>
              {draft[fade.flag] && (
                <ColorInput
                  label={fade.colorLabel}
                  value={draft[fade.color]}
                  onChange={(color) => onChange({ [fade.color]: color })}
                  className="min-h-14 pt-2.5 pb-3.5"
                >
                  <span className="text-sm text-muted-foreground">
                    Fades to
                  </span>
                </ColorInput>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
