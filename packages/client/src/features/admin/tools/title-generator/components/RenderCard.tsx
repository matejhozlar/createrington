import { useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_ANTIALIAS_RESOLUTION, MAX_RENDER_SIZE } from "../engine/render";
import { WORDMARK_CAMERA_DISTANCE } from "../engine/settings";
import type { RenderSettings } from "../engine/types";
import { ChoiceField, Section, SliderField, ToggleField } from "./fields";

const PRESET_RESOLUTIONS = [480, 720, 1024, 2048, 4096] as const;

const RESOLUTION_LABELS: Record<number, string> = {
  480: "480",
  720: "720",
  1024: "1K",
  2048: "2K",
  4096: "4K",
};

export function RenderCard({
  render,
  onChange,
}: {
  render: RenderSettings;
  onChange: (patch: Partial<RenderSettings>) => void;
}) {
  const maxResolution = render.antialias
    ? MAX_ANTIALIAS_RESOLUTION
    : MAX_RENDER_SIZE;
  const isPreset = (PRESET_RESOLUTIONS as readonly number[]).includes(
    render.resolution,
  );
  const [custom, setCustom] = useState(!isPreset);
  const choice = custom ? "custom" : String(render.resolution);

  const options = [
    ...PRESET_RESOLUTIONS.map((value) => ({
      value: String(value),
      label: RESOLUTION_LABELS[value],
      disabled: value > maxResolution,
    })),
    { value: "custom", label: "Custom" },
  ];

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-4 text-muted-foreground" />
          Render
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Section
          title="Resolution"
          description="The width or height of the render, whichever is larger."
        >
          <ChoiceField
            value={choice}
            options={options}
            onChange={(value) => {
              setCustom(value === "custom");
              if (value !== "custom") onChange({ resolution: Number(value) });
            }}
          />
          {custom && (
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="title-render-resolution"
                className="text-sm font-medium"
              >
                Custom resolution
              </Label>
              <Input
                id="title-render-resolution"
                type="number"
                min={1}
                max={maxResolution}
                value={render.resolution}
                onChange={(event) => {
                  const value = Math.round(Number(event.target.value));
                  if (Number.isFinite(value)) {
                    onChange({
                      resolution: Math.min(maxResolution, Math.max(1, value)),
                    });
                  }
                }}
                className="w-32 tabular-nums"
              />
            </div>
          )}
          <ToggleField
            label="Antialiasing"
            checked={render.antialias}
            onChange={(antialias) =>
              onChange({
                antialias,
                resolution: antialias
                  ? Math.min(render.resolution, MAX_ANTIALIAS_RESOLUTION)
                  : render.resolution,
              })
            }
          />
        </Section>

        <Section
          title="Camera"
          description="100% is Blockbench's Position camera angle. The Createrington wordmark was rendered zoomed out to 146.9%."
          action={
            render.cameraDistance !== WORDMARK_CAMERA_DISTANCE && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Reset camera distance"
                onClick={() =>
                  onChange({ cameraDistance: WORDMARK_CAMERA_DISTANCE })
                }
              >
                <RotateCcw className="size-4" />
              </Button>
            )
          }
        >
          <SliderField
            label="Distance"
            value={Math.round(render.cameraDistance * 1000) / 10}
            min={50}
            max={300}
            step={0.1}
            suffix="%"
            onChange={(value) => onChange({ cameraDistance: value / 100 })}
          />
        </Section>
      </CardContent>
    </Card>
  );
}
