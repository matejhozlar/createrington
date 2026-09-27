import { useRef } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastActions } from "@/hooks/use-toast";
import { assetUrl, thumbnailPath } from "../engine/assets";
import { readFileAsDataUrl } from "../engine/canvas";
import type { OverlaySource } from "../engine/types";
import { useFontTextures } from "../hooks/use-title-assets";
import {
  AssetGrid,
  BlendField,
  ChoiceField,
  ColourField,
  Section,
  SliderField,
} from "./fields";
import type { LayerTabProps } from "./types";

const SOURCES: { value: OverlaySource; label: string }[] = [
  { value: "premade", label: "Overlays" },
  { value: "file", label: "File" },
];

export function OverlayTab({ layer, onChange }: LayerTabProps) {
  const toast = useToastActions();
  const textures = useFontTextures(layer.font);
  const fileInput = useRef<HTMLInputElement>(null);

  const options = (textures.data?.overlays ?? []).map((overlay) => ({
    id: overlay.id,
    name: overlay.name,
    author: overlay.author,
    image:
      overlay.id === "none"
        ? undefined
        : assetUrl(thumbnailPath(layer.font, overlay.id)),
  }));

  const uploadOverlay = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange({ customOverlay: await readFileAsDataUrl(file) });
    } catch {
      toast.error("Unable to load overlay");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ChoiceField
        value={layer.overlaySource}
        options={SOURCES}
        onChange={(overlaySource) => onChange({ overlaySource })}
      />

      {layer.overlaySource === "premade" ? (
        <Section
          title="Overlay"
          description="A texture drawn on top of the chosen texture, like highlights, cracks or a bevel."
        >
          {textures.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading overlays...</p>
          ) : (
            <AssetGrid
              options={options}
              selected={layer.overlay}
              onSelect={(overlay) => onChange({ overlay })}
            />
          )}
        </Section>
      ) : (
        <Section title="Custom Overlay">
          <input
            ref={fileInput}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(event) => {
              uploadOverlay(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {layer.customOverlay && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <img
                src={layer.customOverlay}
                alt=""
                className="h-16 max-w-48 object-contain [image-rendering:pixelated]"
              />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove overlay"
                onClick={() => onChange({ customOverlay: null })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => fileInput.current?.click()}
          >
            <ImageUp className="size-4" />
            {layer.customOverlay ? "Replace file" : "Select file"}
          </Button>
        </Section>
      )}

      <Section title="Blending">
        <div className="flex flex-wrap gap-4">
          <BlendField
            label="Overlay blend"
            value={layer.overlayBlend}
            onChange={(overlayBlend) => onChange({ overlayBlend })}
          />
          <ColourField
            label="Overlay colour"
            value={layer.overlayColour}
            onChange={(overlayColour) => onChange({ overlayColour })}
          />
          <BlendField
            label="Colour blend"
            value={layer.overlayColourBlend}
            onChange={(overlayColourBlend) => onChange({ overlayColourBlend })}
          />
        </div>
        <SliderField
          label="Opacity"
          value={layer.overlayOpacity}
          min={0}
          max={100}
          suffix="%"
          onChange={(overlayOpacity) => onChange({ overlayOpacity })}
        />
      </Section>
    </div>
  );
}
