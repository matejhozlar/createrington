import { Frame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasFixedLayout } from "../engine/output";
import { MAX_RENDER_SIZE } from "../engine/render";
import type {
  MinecraftMode,
  OutputMode,
  OutputSettings,
} from "../engine/types";
import { ColourField, Section, SliderField, ToggleField } from "./fields";

const LAYOUTS: { value: OutputMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "square", label: "Square" },
  { value: "custom", label: "Custom" },
  { value: "minecraft", label: "Minecraft" },
  { value: "createrington", label: "Createrington" },
];

const MINECRAFT_MODES: { value: MinecraftMode; label: string }[] = [
  { value: "1.20", label: "1.20+ title texture" },
  { value: "mojang", label: "Mojang Studios texture" },
];

const LAYOUT_DESCRIPTIONS: Record<OutputMode, string> = {
  normal: "Cropped tightly to the title.",
  square: "Centred on a square canvas.",
  custom: "Fitted inside a canvas of your chosen size.",
  minecraft: "Laid out as a resource pack title texture.",
  createrington:
    "A 512 × 512 tile on the site's dark background, for mod logos and avatars.",
};

function SizeInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={MAX_RENDER_SIZE}
        value={value}
        onChange={(event) => {
          const next = Math.round(Number(event.target.value));
          if (Number.isFinite(next)) {
            onChange(Math.min(MAX_RENDER_SIZE, Math.max(1, next)));
          }
        }}
        className="w-28 tabular-nums"
      />
    </div>
  );
}

export function OutputCard({
  output,
  onChange,
}: {
  output: OutputSettings;
  onChange: (patch: Partial<OutputSettings>) => void;
}) {
  const isMinecraft = output.mode === "minecraft";

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Frame className="size-4 text-muted-foreground" />
          Output
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Section title="Layout" description={LAYOUT_DESCRIPTIONS[output.mode]}>
          <Select
            value={output.mode}
            onValueChange={(value) => onChange({ mode: value as OutputMode })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAYOUTS.map((layout) => (
                <SelectItem key={layout.value} value={layout.value}>
                  {layout.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {output.mode === "custom" && (
            <div className="flex flex-wrap gap-4">
              <SizeInput
                id="title-output-width"
                label="Width"
                value={output.resolutionWidth}
                onChange={(resolutionWidth) => onChange({ resolutionWidth })}
              />
              <SizeInput
                id="title-output-height"
                label="Height"
                value={output.resolutionHeight}
                onChange={(resolutionHeight) => onChange({ resolutionHeight })}
              />
            </div>
          )}
          {isMinecraft && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium">Texture mode</Label>
              <Select
                value={output.minecraftMode}
                onValueChange={(value) =>
                  onChange({ minecraftMode: value as MinecraftMode })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINECRAFT_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Section>

        {!hasFixedLayout(output.mode) && (
          <Section title="Background">
            <ToggleField
              label="Background colour"
              checked={output.backgroundColourEnabled}
              onChange={(backgroundColourEnabled) =>
                onChange({ backgroundColourEnabled })
              }
            />
            {output.backgroundColourEnabled && (
              <div className="flex flex-col gap-3">
                <ColourField
                  label="Colour"
                  value={output.backgroundColour}
                  onChange={(backgroundColour) =>
                    onChange({ backgroundColour })
                  }
                />
                <ToggleField
                  label="Vertical gradient"
                  checked={output.backgroundColour2Enabled}
                  onChange={(backgroundColour2Enabled) =>
                    onChange({ backgroundColour2Enabled })
                  }
                />
                {output.backgroundColour2Enabled && (
                  <ColourField
                    label="Bottom colour"
                    value={output.backgroundColour2}
                    onChange={(backgroundColour2) =>
                      onChange({ backgroundColour2 })
                    }
                  />
                )}
              </div>
            )}
            <SliderField
              label="Padding"
              value={output.padding}
              min={0}
              max={1024}
              suffix="px"
              onChange={(padding) => onChange({ padding })}
            />
          </Section>
        )}
      </CardContent>
    </Card>
  );
}
