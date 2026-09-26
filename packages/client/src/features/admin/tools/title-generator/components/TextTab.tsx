import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { assetUrl, thumbnailPath } from "../engine/assets";
import { normalizeTitleText } from "../engine/geometry";
import { fontSwitchPatch } from "../engine/settings";
import type { TextType } from "../engine/types";
import { useFontCharacters } from "../hooks/use-title-assets";
import { AssetGrid, ChoiceField, Section, SliderField } from "./fields";
import type { LayerTabProps } from "./types";

const TEXT_TYPES: { value: TextType; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "small", label: "Small" },
];

const IGNORED_CHARACTERS = new Set([" ", "┫", "┣", "​"]);

export function TextTab({ layer, catalog, onChange }: LayerTabProps) {
  const characters = useFontCharacters(layer.font);
  const baseFont = catalog.fonts[layer.baseFont];

  const missing = useMemo(() => {
    if (!characters.data) return [];
    const unsupported = new Set<string>();
    for (const char of normalizeTitleText(layer.text)) {
      if (!IGNORED_CHARACTERS.has(char) && !characters.data[char]) {
        unsupported.add(char === "😳" ? "A" : char === "😩" ? "'" : char);
      }
    }
    return [...unsupported];
  }, [characters.data, layer.text]);

  const selectFont = async (fontId: string) => {
    onChange(await fontSwitchPatch(fontId, catalog));
  };

  const fontOptions = catalog.baseFonts.map((id) => ({
    id,
    name: catalog.fonts[id].name,
    author: catalog.fonts[id].author,
    image: assetUrl(thumbnailPath(id, "flat")),
    hasVariants: catalog.fonts[id].variants.length > 0,
  }));

  const variantOptions = baseFont?.variants.length
    ? [
        {
          id: baseFont.id,
          name: "Default",
          image: assetUrl(thumbnailPath(baseFont.id, "flat")),
        },
        ...baseFont.variants.map((id) => ({
          id,
          name: catalog.fonts[id].name,
          author: catalog.fonts[id].author,
          image: assetUrl(thumbnailPath(id, "flat")),
        })),
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Text"
        description="Uppercase A becomes the creeper-face A. Other letters are case-insensitive."
      >
        <Input
          value={layer.text}
          placeholder="Minecraft"
          onChange={(event) => onChange({ text: event.target.value })}
        />
        {missing.length > 0 && (
          <p className="text-sm text-yellow-500">
            Not in this font, skipped: {missing.join(" ")}
          </p>
        )}
      </Section>

      <Section title="Font">
        <AssetGrid
          options={fontOptions}
          selected={layer.baseFont}
          onSelect={selectFont}
        />
      </Section>

      {variantOptions.length > 0 && (
        <Section title="Font Variant">
          <AssetGrid
            options={variantOptions}
            selected={layer.font}
            onSelect={selectFont}
          />
        </Section>
      )}

      <Section
        title="Placement"
        description="Top is the main title, Bottom lies flat underneath like the edition text, Small sits below as a subtitle. Rows stack texts of the same type."
      >
        <ChoiceField
          value={layer.type}
          options={TEXT_TYPES}
          onChange={(type) => onChange({ type })}
        />
        <SliderField
          label="Row"
          value={layer.row}
          min={-10}
          max={10}
          onChange={(row) => onChange({ row })}
        />
      </Section>
    </div>
  );
}
