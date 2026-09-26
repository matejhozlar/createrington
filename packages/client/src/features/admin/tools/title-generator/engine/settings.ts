import {
  DEFAULT_FONT,
  loadAssetImage,
  loadFontTextures,
  tileablePath,
} from "./assets";
import type { Catalog } from "./assets";
import type { GeometryOptions } from "./geometry";
import type {
  FontTextures,
  OutputMode,
  OutputSettings,
  RenderSettings,
  TextureArgs,
  TextureSource,
  TitleLayer,
} from "./types";

export const PRESET_TYPE = "minecraft_title_generator_preset";

export const DEFAULT_GRADIENT = {
  gradientColour0: "#FFCF76",
  gradientColour1: "#FFA3A3",
  gradientColour2: "#F4C1A4",
  gradientColour3: "#E19A3E",
  gradientColour4: "#DA371E",
} as const;

const LAYER_DEFAULTS: Omit<TitleLayer, "id" | "text"> = {
  font: DEFAULT_FONT,
  baseFont: DEFAULT_FONT,
  fontVariant: null,
  type: "top",
  row: 0,
  textureSource: "premade",
  lastTextureSource: "premade",
  texture: "cracked",
  variant: null,
  tileable: "cobblestone",
  tileableVariant: null,
  smoothGradient: true,
  ...DEFAULT_GRADIENT,
  gradientColour1Enabled: false,
  gradientColour2Enabled: false,
  gradientColour3Enabled: false,
  customTextureType: "texture",
  customTexture: null,
  overlaySource: "premade",
  overlay: "none",
  overlayBlend: "overlay",
  overlayColourBlend: "multiply",
  overlayColour: "#fff",
  overlayOpacity: 100,
  customOverlay: null,
  tileableScale: 2,
  tileableXOffset: 0,
  tileableYOffset: 0,
  tileableRandomRotations: false,
  tileableRandomMirroring: false,
  tileableTextureResolution: 1,
  disableFontOverlay: false,
  hue: 0,
  saturation: 100,
  brightness: 100,
  contrast: 100,
  blend: "multiply",
  colour: "#fff",
  colourOpacity: 100,
  customBorder: false,
  customBorderColour: "#000",
  fadeToBorder: false,
  customEdge: false,
  customEdgeColour: "#000",
  edgeBrightness: 35,
  terminators: false,
  characterSpacing: 0,
  rowSpacing: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  disableCharacterShifting: false,
};

export const DEFAULT_CAMERA_DISTANCE = 1.469;

export const DEFAULT_RENDER: RenderSettings = {
  resolution: 1024,
  antialias: true,
  cameraDistance: DEFAULT_CAMERA_DISTANCE,
};

export const OUTPUT_MODES: OutputMode[] = [
  "normal",
  "square",
  "custom",
  "minecraft",
  "createrington",
];

export const DEFAULT_OUTPUT: OutputSettings = {
  mode: "normal",
  resolutionWidth: 1920,
  resolutionHeight: 1080,
  minecraftMode: "1.20",
  backgroundColourEnabled: false,
  backgroundColour: "#78b8ff",
  backgroundColour2Enabled: false,
  backgroundColour2: "#c7ecff",
  padding: 0,
};

let layerCounter = 0;

export function createLayer(overrides: Partial<TitleLayer> = {}): TitleLayer {
  layerCounter += 1;
  const { id, ...rest } = overrides;
  return {
    ...LAYER_DEFAULTS,
    text: "",
    ...rest,
    id: id ?? `layer-${Date.now()}-${layerCounter}`,
  };
}

const STYLE_KEYS = [
  "overlaySource",
  "overlay",
  "overlayBlend",
  "overlayColourBlend",
  "overlayColour",
  "overlayOpacity",
  "customOverlay",
  "tileableScale",
  "tileableXOffset",
  "tileableYOffset",
  "tileableRandomRotations",
  "tileableRandomMirroring",
  "tileableTextureResolution",
  "disableFontOverlay",
  "hue",
  "saturation",
  "brightness",
  "contrast",
  "blend",
  "colour",
  "colourOpacity",
  "customBorder",
  "customBorderColour",
  "fadeToBorder",
  "customEdge",
  "customEdgeColour",
  "edgeBrightness",
] as const satisfies readonly (keyof TitleLayer)[];

export function styleDefaults(): Partial<TitleLayer> {
  return Object.fromEntries(
    STYLE_KEYS.map((key) => [key, LAYER_DEFAULTS[key]]),
  );
}

export const WORDMARK_LAYERS = (): TitleLayer[] => [
  createLayer({ text: "Minecraft" }),
  createLayer({
    text: "CreAterington",
    type: "bottom",
    texture: "bevelled_gold",
    fadeToBorder: true,
  }),
];

export function defaultTextureId(textures: FontTextures) {
  return textures.textures[1]?.id ?? textures.textures[0]?.id ?? "flat";
}

export async function fontSwitchPatch(
  fontId: string,
  catalog: Catalog,
): Promise<Partial<TitleLayer>> {
  const font = catalog.fonts[fontId];
  const textures = await loadFontTextures(fontId);
  return {
    font: fontId,
    baseFont: font.baseFont,
    fontVariant: font.baseFont === fontId ? null : fontId,
    texture: defaultTextureId(textures),
    variant: null,
    overlay: textures.overlays[0]?.id ?? "none",
    characterSpacing: font.characterSpacing ?? 0,
  };
}

export async function repairLayer(
  layer: TitleLayer,
  catalog: Catalog,
): Promise<Partial<TitleLayer> | null> {
  if (!catalog.fonts[layer.font]) {
    const fallback = catalog.fonts[layer.baseFont]
      ? layer.baseFont
      : DEFAULT_FONT;
    return fontSwitchPatch(fallback, catalog);
  }
  const textures = await loadFontTextures(layer.font);
  const patch: Partial<TitleLayer> = {};
  const texture = textures.textures.find((entry) => entry.id === layer.texture);
  if (!texture) {
    patch.texture = defaultTextureId(textures);
    patch.variant = null;
  } else if (layer.variant && !texture.variants?.[layer.variant]) {
    patch.variant = null;
  }
  if (!textures.overlays.some((entry) => entry.id === layer.overlay)) {
    patch.overlay = textures.overlays[0]?.id ?? "none";
  }
  const tileable = catalog.tileables.find(
    (entry) => entry.id === layer.tileable,
  );
  if (!tileable) {
    patch.tileable = catalog.tileables[0]?.id ?? layer.tileable;
    patch.tileableVariant = null;
  } else if (
    layer.tileableVariant &&
    !tileable.variants?.[layer.tileableVariant]
  ) {
    patch.tileableVariant = null;
  }
  return Object.keys(patch).length ? patch : null;
}

function effectiveSource(layer: TitleLayer): TextureSource {
  if (layer.textureSource === "file" && !layer.customTexture) {
    return layer.lastTextureSource;
  }
  return layer.textureSource;
}

export function resolveTextureArgs(layer: TitleLayer): TextureArgs {
  const source = effectiveSource(layer);
  const customTexture =
    layer.textureSource === "file" ? layer.customTexture : null;
  return {
    font: layer.font,
    texture: source === "premade" ? layer.texture : "flat",
    variant: source === "premade" ? layer.variant : null,
    tileable: source === "tileable" ? layer.tileable : null,
    tileableVariant: source === "tileable" ? layer.tileableVariant : null,
    customTexture,
    customTextureType: layer.customTextureType,
    customOverlay: layer.overlaySource === "file" ? layer.customOverlay : null,
    overlay: layer.overlay,
    gradientColours:
      source === "gradient"
        ? [
            layer.gradientColour0,
            layer.gradientColour1,
            layer.gradientColour2,
            layer.gradientColour3,
            layer.gradientColour4,
          ]
        : null,
    smoothGradient: layer.smoothGradient,
    gradientColour1Enabled: layer.gradientColour1Enabled,
    gradientColour2Enabled: layer.gradientColour2Enabled,
    gradientColour3Enabled: layer.gradientColour3Enabled,
    overlayBlend: layer.overlayBlend,
    overlayColourBlend: layer.overlayColourBlend,
    overlayColour: layer.overlayColour,
    overlayOpacity: layer.overlayOpacity,
    tileableScale: layer.tileableScale,
    tileableXOffset: layer.tileableXOffset,
    tileableYOffset: layer.tileableYOffset,
    tileableRandomRotations: layer.tileableRandomRotations,
    tileableRandomMirroring: layer.tileableRandomMirroring,
    tileableTextureResolution: layer.tileableTextureResolution,
    disableFontOverlay: layer.disableFontOverlay,
    hue: layer.hue,
    saturation: layer.saturation,
    brightness: layer.brightness,
    contrast: layer.contrast,
    blend: layer.blend,
    colour: layer.colour,
    colourOpacity: layer.colourOpacity,
    customBorder: layer.customBorder,
    customBorderColour: layer.customBorderColour,
    fadeToBorder: layer.fadeToBorder,
    customEdge: layer.customEdge,
    customEdgeColour: layer.customEdgeColour,
    edgeBrightness: layer.edgeBrightness,
  };
}

export function geometryOptions(layer: TitleLayer): GeometryOptions {
  return {
    type: layer.type,
    row: layer.row,
    rowSpacing: layer.rowSpacing,
    characterSpacing: layer.characterSpacing,
    scale: [layer.scaleX, layer.scaleY, layer.scaleZ],
    terminators: layer.terminators,
    disableCharacterShifting: layer.disableCharacterShifting,
  };
}

const PRESET_KEYS = [
  "baseFont",
  "fontVariant",
  "type",
  "row",
  "texture",
  "variant",
  "tileable",
  "tileableVariant",
  "smoothGradient",
  "gradientColour0",
  "gradientColour1",
  "gradientColour2",
  "gradientColour3",
  "gradientColour4",
  "gradientColour1Enabled",
  "gradientColour2Enabled",
  "gradientColour3Enabled",
  "customTextureType",
  "textureSource",
  "customTexture",
  "terminators",
  "characterSpacing",
  "rowSpacing",
  "scaleX",
  "scaleY",
  "scaleZ",
  "disableCharacterShifting",
  "overlay",
  "overlayBlend",
  "overlayColourBlend",
  "overlayColour",
  "overlayOpacity",
  "overlaySource",
  "customOverlay",
  "tileableScale",
  "tileableXOffset",
  "tileableYOffset",
  "tileableRandomRotations",
  "tileableRandomMirroring",
  "tileableTextureResolution",
  "disableFontOverlay",
  "hue",
  "saturation",
  "brightness",
  "contrast",
  "blend",
  "customBorder",
  "customEdge",
  "colourOpacity",
  "colour",
  "customBorderColour",
  "customEdgeColour",
  "edgeBrightness",
  "fadeToBorder",
] as const satisfies readonly (keyof TitleLayer)[];

const RESOLVED_PRESET_KEYS = new Set<string>([
  "baseFont",
  "fontVariant",
  "texture",
  "variant",
  "tileable",
  "tileableVariant",
  "overlay",
  "tileableXOffset",
  "tileableYOffset",
]);

export class PresetError extends Error {}

export function exportPreset(layer: TitleLayer) {
  if (layer.textureSource === "file" || layer.overlaySource === "file") {
    throw new PresetError("Custom textures are not supported for presets");
  }
  const args = resolveTextureArgs(layer);
  const preset: Record<string, unknown> = { fontType: "font" };
  for (const key of PRESET_KEYS) preset[key] = layer[key];
  preset.texture = args.texture;
  preset.variant = args.variant;
  preset.tileable = args.tileable;
  preset.tileableVariant = args.tileableVariant;
  preset.customTexture = null;
  preset.customOverlay = null;
  const gradient = args.gradientColours;
  for (let i = 0; i < 5; i++)
    preset[`gradientColour${i}`] = gradient?.[i] ?? null;
  return { type: PRESET_TYPE, preset };
}

export function parsePreset(json: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(json.trim());
  } catch {
    throw new PresetError("Invalid JSON for preset data");
  }
  if (
    typeof data !== "object" ||
    data === null ||
    (data as { type?: unknown }).type !== PRESET_TYPE ||
    typeof (data as { preset?: unknown }).preset !== "object"
  ) {
    throw new PresetError("Invalid preset");
  }
  const preset = (data as { preset: Record<string, unknown> }).preset;
  if (preset.fontType === "shape") {
    throw new PresetError("Shape presets are not supported");
  }
  return preset;
}

export async function applyPreset(
  layer: TitleLayer,
  preset: Record<string, unknown>,
  catalog: Catalog,
): Promise<TitleLayer> {
  let next: TitleLayer = createLayer({ id: layer.id, text: layer.text });
  const writable = next as Record<string, unknown>;
  for (const key of PRESET_KEYS) {
    const value = preset[key];
    if (
      RESOLVED_PRESET_KEYS.has(key) ||
      value === undefined ||
      value === null
    ) {
      continue;
    }
    if (typeof value !== typeof writable[key]) continue;
    writable[key] = value;
  }
  if (next.textureSource === "file") next.textureSource = "premade";
  if (next.overlaySource === "file") next.overlaySource = "premade";
  const characterSpacing = next.characterSpacing;

  const baseFont = String(preset.baseFont ?? "");
  const fontVariant = String(preset.fontVariant ?? "");
  let fontId = catalog.fonts[baseFont] ? baseFont : DEFAULT_FONT;
  if (catalog.fonts[fontId].variants.includes(fontVariant))
    fontId = fontVariant;
  next = {
    ...next,
    ...(await fontSwitchPatch(fontId, catalog)),
    characterSpacing,
  };

  const textures = await loadFontTextures(fontId);
  const texture = textures.textures.find(
    (entry) => entry.id === preset.texture,
  );
  if (texture) {
    next.texture = texture.id;
    const variant = String(preset.variant ?? "");
    if (texture.variants?.[variant]) next.variant = variant;
  }
  if (textures.overlays.some((entry) => entry.id === preset.overlay)) {
    next.overlay = String(preset.overlay);
  }
  const tileable = catalog.tileables.find(
    (entry) => entry.id === preset.tileable,
  );
  if (tileable) {
    next.tileable = tileable.id;
    const variant = String(preset.tileableVariant ?? "");
    if (tileable.variants?.[variant]) next.tileableVariant = variant;
    const x = Number(preset.tileableXOffset) || 0;
    const y = Number(preset.tileableYOffset) || 0;
    if (x || y) {
      const img = await loadAssetImage(
        tileablePath(tileable, next.tileableVariant),
      );
      next.tileableXOffset = Math.min(img.width - 1, x);
      next.tileableYOffset = Math.min(img.height - 1, y);
    }
  }
  return next;
}
