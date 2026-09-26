import { tileableSource, useImageSize } from "../hooks/use-title-assets";
import {
  BlendField,
  ColourField,
  Section,
  SliderField,
  ToggleField,
} from "./fields";
import type { LayerTabProps } from "./types";

const FILTERS = [
  { key: "hue", label: "Hue", max: 359, suffix: "°" },
  { key: "saturation", label: "Saturation", max: 200, suffix: "%" },
  { key: "brightness", label: "Brightness", max: 200, suffix: "%" },
  { key: "contrast", label: "Contrast", max: 200, suffix: "%" },
] as const;

export function StyleTab({ layer, catalog, onChange }: LayerTabProps) {
  const font = catalog.fonts[layer.font];
  const customTileable =
    layer.textureSource === "file" &&
    !!layer.customTexture &&
    layer.customTextureType === "tileable";
  const isTileable = layer.textureSource === "tileable" || customTileable;
  const tileSource = customTileable
    ? layer.customTexture
    : layer.textureSource === "tileable"
      ? tileableSource(catalog.tileables, layer.tileable, layer.tileableVariant)
      : null;
  const tileSize = useImageSize(tileSource);
  const maxX = Math.max(0, (tileSize.data?.width ?? 1) - 1);
  const maxY = Math.max(0, (tileSize.data?.height ?? 1) - 1);

  const fontOverlayToggle = font.overlay && (
    <ToggleField
      label="Disable included font overlay"
      checked={layer.disableFontOverlay}
      onChange={(disableFontOverlay) => onChange({ disableFontOverlay })}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {isTileable && (
        <Section title="Tileable" description="Configure the repeated texture.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SliderField
              label="Scale"
              value={layer.tileableScale}
              min={1}
              max={8}
              onChange={(tileableScale) => onChange({ tileableScale })}
            />
            <SliderField
              label="Texture resolution"
              value={layer.tileableTextureResolution}
              min={1}
              max={4}
              suffix="x"
              onChange={(tileableTextureResolution) =>
                onChange({ tileableTextureResolution })
              }
            />
            <SliderField
              label="X offset"
              value={Math.min(layer.tileableXOffset, maxX)}
              min={0}
              max={maxX}
              onChange={(tileableXOffset) => onChange({ tileableXOffset })}
            />
            <SliderField
              label="Y offset"
              value={Math.min(layer.tileableYOffset, maxY)}
              min={0}
              max={maxY}
              onChange={(tileableYOffset) => onChange({ tileableYOffset })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <ToggleField
              label="Random rotations"
              checked={layer.tileableRandomRotations}
              onChange={(tileableRandomRotations) =>
                onChange({ tileableRandomRotations })
              }
            />
            <ToggleField
              label="Random mirroring"
              checked={layer.tileableRandomMirroring}
              onChange={(tileableRandomMirroring) =>
                onChange({ tileableRandomMirroring })
              }
            />
            {fontOverlayToggle}
          </div>
        </Section>
      )}

      {layer.textureSource === "gradient" && fontOverlayToggle && (
        <Section title="Gradient">{fontOverlayToggle}</Section>
      )}

      <Section title="Filters">
        <div className="grid gap-4 sm:grid-cols-2">
          {FILTERS.map((filter) => (
            <SliderField
              key={filter.key}
              label={filter.label}
              value={layer[filter.key]}
              min={0}
              max={filter.max}
              suffix={filter.suffix}
              onChange={(value) => onChange({ [filter.key]: value })}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Colour"
        description="A colour blended over the whole texture."
      >
        <div className="flex flex-wrap gap-4">
          <ColourField
            label="Colour"
            value={layer.colour}
            onChange={(colour) => onChange({ colour })}
          />
          <BlendField
            label="Blend"
            value={layer.blend}
            onChange={(blend) => onChange({ blend })}
          />
        </div>
        <SliderField
          label="Opacity"
          value={layer.colourOpacity}
          min={0}
          max={100}
          suffix="%"
          onChange={(colourOpacity) => onChange({ colourOpacity })}
        />
      </Section>

      <Section title="Border" description="The outline around the letters.">
        <div className="flex flex-wrap items-end gap-4">
          <ToggleField
            label="Custom border colour"
            checked={layer.customBorder}
            onChange={(customBorder) => onChange({ customBorder })}
          />
          {layer.customBorder && (
            <ColourField
              label="Border colour"
              value={layer.customBorderColour}
              onChange={(customBorderColour) =>
                onChange({ customBorderColour })
              }
            />
          )}
        </div>
        <ToggleField
          label="Fade the top and bottom into the border colour"
          checked={layer.fadeToBorder}
          onChange={(fadeToBorder) => onChange({ fadeToBorder })}
        />
      </Section>

      <Section
        title="Edges"
        description="The top and bottom faces of the letters."
      >
        <div className="flex flex-wrap items-end gap-4">
          <ToggleField
            label="Custom top and bottom colour"
            checked={layer.customEdge}
            onChange={(customEdge) => onChange({ customEdge })}
          />
          {layer.customEdge && (
            <ColourField
              label="Edge colour"
              value={layer.customEdgeColour}
              onChange={(customEdgeColour) => onChange({ customEdgeColour })}
            />
          )}
        </div>
        {!layer.customEdge &&
          (isTileable || layer.textureSource === "gradient") && (
            <SliderField
              label="Edge brightness"
              value={layer.edgeBrightness}
              min={0}
              max={100}
              suffix="%"
              onChange={(edgeBrightness) => onChange({ edgeBrightness })}
            />
          )}
      </Section>
    </div>
  );
}
