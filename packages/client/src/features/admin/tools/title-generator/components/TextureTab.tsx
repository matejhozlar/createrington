import { useRef, useState } from "react";
import { ImageUp, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastActions } from "@/hooks/use-toast";
import { assetUrl, thumbnailPath, tileablePath } from "../engine/assets";
import { loadImage, readFileAsDataUrl } from "../engine/canvas";
import { getLayerTexture } from "../engine/pipeline";
import { DEFAULT_GRADIENT, styleDefaults } from "../engine/settings";
import type { TextureSource, TitleLayer } from "../engine/types";
import { useFontTextures } from "../hooks/use-title-assets";
import {
  AssetGrid,
  ChoiceField,
  ColourField,
  Section,
  ToggleField,
  type AssetOption,
} from "./fields";
import type { LayerTabProps } from "./types";

const SOURCES: { value: TextureSource; label: string }[] = [
  { value: "premade", label: "Textures" },
  { value: "tileable", label: "Tileables" },
  { value: "gradient", label: "Gradient" },
  { value: "file", label: "File" },
];

const SEARCH_THRESHOLD = 16;

const GRADIENT_STOPS = [
  { key: "gradientColour0", label: "Top", toggle: null },
  {
    key: "gradientColour1",
    label: "Upper middle",
    toggle: "gradientColour1Enabled",
  },
  { key: "gradientColour2", label: "Middle", toggle: "gradientColour2Enabled" },
  {
    key: "gradientColour3",
    label: "Lower middle",
    toggle: "gradientColour3Enabled",
  },
  { key: "gradientColour4", label: "Bottom", toggle: null },
] as const;

const STOP_CONFIGS = [
  [0.5],
  [0.4, 0.8],
  [1 / 3, 2 / 3],
  [0.3, 0.6, 0.8],
  [0.2, 0.6],
  [0.2, 0.5, 0.8],
  [0.2, 0.4, 0.7],
  [0.2, 0.4, 0.6, 0.8],
];

function gradientPreview(layer: TitleLayer) {
  const enabled = [
    layer.gradientColour1Enabled,
    layer.gradientColour2Enabled,
    layer.gradientColour3Enabled,
  ];
  const colours = [
    layer.gradientColour0,
    layer.gradientColour1,
    layer.gradientColour2,
    layer.gradientColour3,
    layer.gradientColour4,
  ];
  if (layer.smoothGradient) {
    const stops = [
      `${colours[0]} 0%`,
      ...[1, 2, 3]
        .filter((i) => enabled[i - 1])
        .map((i) => `${colours[i]} ${i * 25}%`),
      `${colours[4]} 100%`,
    ];
    return `linear-gradient(${stops.join(", ")})`;
  }
  const config =
    STOP_CONFIGS[
      (Number(enabled[0]) << 2) | (Number(enabled[1]) << 1) | Number(enabled[2])
    ];
  const stops: string[] = [];
  let prev = 0;
  for (let i = 0, j = 0; i < 5; i++) {
    if (!(enabled[i - 1] ?? true)) continue;
    const end = config[j] ?? 1;
    stops.push(`${colours[i]} ${prev * 100}%`, `${colours[i]} ${end * 100}%`);
    prev = end;
    j++;
  }
  return `linear-gradient(${stops.join(", ")})`;
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        placeholder="Search..."
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}

const matches = (option: AssetOption, query: string) =>
  `${option.name} ${option.author ?? ""}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());

export function TextureTab({ layer, catalog, onChange }: LayerTabProps) {
  const toast = useToastActions();
  const textures = useFontTextures(layer.font);
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const font = catalog.fonts[layer.font];

  const setSource = (textureSource: TextureSource) =>
    onChange({
      textureSource,
      lastTextureSource:
        layer.textureSource === "file"
          ? layer.lastTextureSource
          : layer.textureSource,
    });

  const textureOptions: AssetOption[] = (textures.data?.textures ?? []).map(
    (texture) => ({
      id: texture.id,
      name: texture.name,
      author: texture.author,
      image: assetUrl(thumbnailPath(layer.font, texture.id)),
      hasVariants: !!texture.variants,
    }),
  );
  const selectedTexture = textures.data?.textures.find(
    (texture) => texture.id === layer.texture,
  );
  const textureVariants: AssetOption[] = selectedTexture?.variants
    ? [
        {
          id: selectedTexture.id,
          name: selectedTexture.name,
          image: assetUrl(thumbnailPath(layer.font, selectedTexture.id)),
        },
        ...Object.entries(selectedTexture.variants).map(([id, variant]) => ({
          id,
          name: variant.name,
          author: variant.author ?? selectedTexture.author,
          image: assetUrl(thumbnailPath(layer.font, id)),
        })),
      ]
    : [];

  const tileableOptions: AssetOption[] = catalog.tileables.map((tileable) => ({
    id: tileable.id,
    name: tileable.category ?? tileable.name,
    author: tileable.author,
    image: assetUrl(tileablePath(tileable, null)),
    pixelated: true,
    hasVariants: !!tileable.variants,
  }));
  const selectedTileable = catalog.tileables.find(
    (tileable) => tileable.id === layer.tileable,
  );
  const tileableVariants: AssetOption[] = selectedTileable?.variants
    ? [
        {
          id: selectedTileable.id,
          name: selectedTileable.name,
          image: assetUrl(tileablePath(selectedTileable, null)),
          pixelated: true,
        },
        ...Object.entries(selectedTileable.variants).map(([id, variant]) => ({
          id,
          name: variant.name,
          image: assetUrl(tileablePath(selectedTileable, id)),
          pixelated: true,
        })),
      ]
    : [];

  const uploadTexture = async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const img = await loadImage(dataUrl);
      const isTexture =
        img.width / img.height === font.textureWidth / font.textureHeight;
      onChange({
        customTexture: dataUrl,
        customTextureType: isTexture ? "texture" : "tileable",
      });
    } catch {
      toast.error("Unable to load texture");
    }
  };

  const bakeTexture = async () => {
    try {
      const canvas = await getLayerTexture(layer, catalog);
      onChange({
        ...styleDefaults(),
        textureSource: "file",
        customTexture: canvas.toDataURL(),
        customTextureType: "texture",
      });
    } catch {
      toast.error("Unable to bake the current texture");
    }
  };

  const filteredTextures =
    textureOptions.length > SEARCH_THRESHOLD && query
      ? textureOptions.filter((option) => matches(option, query))
      : textureOptions;
  const filteredTileables =
    tileableOptions.length > SEARCH_THRESHOLD && query
      ? tileableOptions.filter((option) => matches(option, query))
      : tileableOptions;

  return (
    <div className="flex flex-col gap-6">
      <ChoiceField
        value={layer.textureSource}
        options={SOURCES}
        onChange={setSource}
      />

      {layer.textureSource === "premade" && (
        <>
          <Section title="Texture">
            {textureOptions.length > SEARCH_THRESHOLD && (
              <SearchInput value={query} onChange={setQuery} />
            )}
            {textures.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading textures...
              </p>
            ) : (
              <AssetGrid
                options={filteredTextures}
                selected={layer.texture}
                onSelect={(texture) => onChange({ texture, variant: null })}
              />
            )}
          </Section>
          {textureVariants.length > 0 && (
            <Section title="Variant">
              <AssetGrid
                options={textureVariants}
                selected={layer.variant ?? layer.texture}
                onSelect={(id) =>
                  onChange({ variant: id === layer.texture ? null : id })
                }
              />
            </Section>
          )}
        </>
      )}

      {layer.textureSource === "tileable" && (
        <>
          <Section
            title="Tileable"
            description="A block texture repeated across the letters. Tune it on the Style tab."
          >
            {tileableOptions.length > SEARCH_THRESHOLD && (
              <SearchInput value={query} onChange={setQuery} />
            )}
            <AssetGrid
              tile
              options={filteredTileables}
              selected={layer.tileable}
              onSelect={(tileable) =>
                onChange({
                  tileable,
                  tileableVariant: null,
                  tileableXOffset: 0,
                  tileableYOffset: 0,
                })
              }
            />
          </Section>
          {tileableVariants.length > 0 && (
            <Section title="Variant">
              <AssetGrid
                tile
                options={tileableVariants}
                selected={layer.tileableVariant ?? layer.tileable}
                onSelect={(id) =>
                  onChange({
                    tileableVariant: id === layer.tileable ? null : id,
                    tileableXOffset: 0,
                    tileableYOffset: 0,
                  })
                }
              />
            </Section>
          )}
        </>
      )}

      {layer.textureSource === "gradient" && (
        <Section
          title="Gradient"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...DEFAULT_GRADIENT })}
            >
              <RotateCcw className="size-4" />
              Reset colours
            </Button>
          }
        >
          <div
            className="h-8 w-full rounded-md border border-border"
            style={{ background: gradientPreview(layer) }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {GRADIENT_STOPS.map((stop) => (
              <div key={stop.key} className="flex flex-col gap-2">
                <ColourField
                  label={stop.label}
                  value={layer[stop.key]}
                  disabled={stop.toggle !== null && !layer[stop.toggle]}
                  onChange={(value) => onChange({ [stop.key]: value })}
                />
                {stop.toggle !== null && (
                  <ToggleField
                    label="Enabled"
                    checked={layer[stop.toggle]}
                    onChange={(checked) => onChange({ [stop.toggle]: checked })}
                  />
                )}
              </div>
            ))}
          </div>
          <ToggleField
            label="Smooth gradient"
            checked={layer.smoothGradient}
            onChange={(smoothGradient) => onChange({ smoothGradient })}
          />
        </Section>
      )}

      {layer.textureSource === "file" && (
        <Section
          title="Custom Texture"
          description={`Upload a full ${font.textureWidth}x${font.textureHeight} font texture, or any other image to tile across the letters.`}
        >
          <input
            ref={fileInput}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(event) => {
              uploadTexture(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {layer.customTexture && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <img
                src={layer.customTexture}
                alt=""
                className="h-16 max-w-48 object-contain [image-rendering:pixelated]"
              />
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove texture"
                onClick={() => onChange({ customTexture: null })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => fileInput.current?.click()}
            >
              <ImageUp className="size-4" />
              {layer.customTexture ? "Replace file" : "Select file"}
            </Button>
            {!layer.customTexture && (
              <Button variant="outline" onClick={bakeTexture}>
                Bake current texture into a file
              </Button>
            )}
          </div>
          {layer.customTexture && (
            <ChoiceField
              value={layer.customTextureType}
              options={[
                { value: "texture", label: "Font texture" },
                { value: "tileable", label: "Tileable" },
              ]}
              onChange={(customTextureType) => onChange({ customTextureType })}
            />
          )}
        </Section>
      )}
    </div>
  );
}
