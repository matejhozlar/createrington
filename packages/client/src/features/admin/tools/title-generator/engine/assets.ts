import { loadImage, readFileAsDataUrl } from "./canvas";
import type {
  FontCharacters,
  FontTextures,
  TextureEntry,
  TextureVariant,
  Tileable,
  TitleFont,
} from "./types";

const REPO = "ewanhowell5195/MinecraftTitleGenerator";
const REVISION = "ebc3f4187f5be57e4c25ea3cd9b0b350eceb996a";

export const ASSET_ROOTS = [
  `https://raw.githubusercontent.com/${REPO}/${REVISION}`,
  `https://cdn.jsdelivr.net/gh/${REPO}@${REVISION}`,
];

export const DEFAULT_FONT = "minecraft-ten";

const DEFAULT_TEXTURE_WIDTH = 1000;
const DEFAULT_TEXTURE_HEIGHT = 320;

const MINECRAFT_TEN_METRICS = {
  faces: [
    [22, 62],
    [108, 148],
    [194, 194, 234, 242],
  ],
  ends: [
    [0, 22, 62, 84],
    [86, 108, 148, 170],
    [172, 194, 242, 264],
  ],
  height: 44,
  border: 266,
};

const MINECRAFT_TEN: RawFont = {
  id: DEFAULT_FONT,
  name: "Minecraft Ten",
  ...MINECRAFT_TEN_METRICS,
  terminatorSpace: true,
  shifts: {
    "//": 16,
    "\\\\": 16,
    tj: 8,
    lt: 8,
    ly: 8,
    yj: 6,
    lv: 4,
    qt: 4,
    qv: 4,
    "{{": 4,
    "}}": 4,
    "}]": 4,
    "[{": 4,
    "l?": 4,
    "q?": 4,
    "t.": 4,
    "t,": 4,
    t_: 4,
    "t-": 4,
    "-t": 4,
    "l-": 8,
    "/j": 8,
    "l\\": 8,
  },
};

type RawVariant = Partial<Omit<RawFont, "shifts">> & {
  id: string;
  shifts?: Record<string, number> | "inherit";
};

type RawFont = Partial<Omit<TitleFont, "variants" | "baseFont">> & {
  id: string;
  type?: string;
  variants?: RawVariant[];
};

type RawTextures = {
  textures?: Record<
    string,
    Omit<TextureEntry, "id" | "name" | "variants"> & {
      name?: string;
      variants?: Record<string, Partial<TextureVariant>>;
    }
  >;
  overlays?: Record<string, { name?: string; author?: string }>;
};

type RawTileable = {
  name?: string;
  author?: string;
  category?: string;
  path?: string;
  variants?: Record<string, { name?: string; path?: string }>;
};

export type Catalog = {
  fonts: Record<string, TitleFont>;
  baseFonts: string[];
  tileables: Tileable[];
};

let rootIndex = 0;

export function assetUrl(path: string) {
  return `${ASSET_ROOTS[rootIndex]}/${path}`;
}

async function fetchAsset(path: string): Promise<Response> {
  for (let i = rootIndex; i < ASSET_ROOTS.length; i++) {
    try {
      const response = await fetch(`${ASSET_ROOTS[i]}/${path}`);
      if (response.status !== 200) continue;
      rootIndex = i;
      return response;
    } catch {
      continue;
    }
  }
  throw new Error(`Unable to load ${path}`);
}

async function fetchJson<T>(path: string): Promise<T> {
  return (await fetchAsset(path)).json() as Promise<T>;
}

export function titleCase(value: string) {
  return value
    .replace(/_|-/g, " ")
    .replace(
      /\w\S*/g,
      (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    );
}

function toFont(raw: RawFont, baseFont: string, variants: string[]): TitleFont {
  return {
    ...raw,
    id: raw.id,
    name: raw.name ?? titleCase(raw.id),
    faces: raw.faces ?? MINECRAFT_TEN_METRICS.faces,
    ends: raw.ends ?? MINECRAFT_TEN_METRICS.ends,
    height: raw.height ?? MINECRAFT_TEN_METRICS.height,
    border: raw.border ?? MINECRAFT_TEN_METRICS.border,
    textureWidth: raw.textureWidth ?? DEFAULT_TEXTURE_WIDTH,
    textureHeight: raw.textureHeight ?? DEFAULT_TEXTURE_HEIGHT,
    baseFont,
    variants,
  };
}

export async function loadCatalog(): Promise<Catalog> {
  const [rawFonts, rawTileables] = await Promise.all([
    fetchJson<RawFont[]>("fonts.json"),
    fetchJson<Record<string, RawTileable>>("tileables.json"),
  ]);

  const fonts: Record<string, TitleFont> = {};
  const baseFonts: string[] = [];
  const entries = rawFonts.some((font) => font.id === DEFAULT_FONT)
    ? rawFonts
    : [{ id: DEFAULT_FONT }, ...rawFonts];

  for (const entry of entries) {
    if ((entry.type ?? "font") !== "font") continue;
    const raw: RawFont =
      entry.id === DEFAULT_FONT ? { ...MINECRAFT_TEN, ...entry } : entry;
    const variantIds = (raw.variants ?? []).map((variant) => variant.id);
    fonts[raw.id] = toFont(raw, raw.id, variantIds);
    baseFonts.push(raw.id);

    for (const variant of raw.variants ?? []) {
      const merged: RawFont = { ...raw, ...variant, shifts: undefined };
      delete merged.variants;
      if (variant.shifts === "inherit") merged.shifts = raw.shifts;
      else if (variant.shifts) merged.shifts = variant.shifts;
      fonts[variant.id] = toFont(merged, raw.id, []);
      fonts[variant.id].name = variant.name ?? titleCase(variant.id);
    }
  }

  const tileables = Object.entries(rawTileables).map(([id, raw]): Tileable => {
    const path = raw.path ?? "minecraft";
    return {
      id,
      name: raw.name ?? titleCase(id),
      author: raw.author ?? "Mojang",
      category: raw.category,
      path,
      variants: raw.variants
        ? Object.fromEntries(
            Object.entries(raw.variants).map(([variantId, variant]) => [
              variantId,
              {
                name: variant.name ?? titleCase(variantId),
                path: variant.path ?? path,
              },
            ]),
          )
        : undefined,
    };
  });

  return { fonts, baseFonts, tileables };
}

const fontTexturesCache = new Map<string, Promise<FontTextures>>();

export function loadFontTextures(fontId: string): Promise<FontTextures> {
  let pending = fontTexturesCache.get(fontId);
  if (!pending) {
    pending = fetchJson<RawTextures>(`fonts/${fontId}/textures.json`).then(
      (raw) => ({
        textures: Object.entries(raw.textures ?? {}).map(([id, texture]) => ({
          ...texture,
          id,
          name: texture.name ?? titleCase(id),
          variants: texture.variants
            ? Object.fromEntries(
                Object.entries(texture.variants).map(([variantId, variant]) => [
                  variantId,
                  { ...variant, name: variant.name ?? titleCase(variantId) },
                ]),
              )
            : undefined,
        })),
        overlays: [
          { id: "none", name: "None" },
          ...Object.entries(raw.overlays ?? {}).map(([id, overlay]) => ({
            ...overlay,
            id,
            name: overlay.name ?? titleCase(id),
          })),
        ],
      }),
    );
    pending.catch(() => fontTexturesCache.delete(fontId));
    fontTexturesCache.set(fontId, pending);
  }
  return pending;
}

const charactersCache = new Map<string, Promise<FontCharacters>>();

export function loadCharacters(fontId: string): Promise<FontCharacters> {
  let pending = charactersCache.get(fontId);
  if (!pending) {
    pending = fetchJson<FontCharacters>(`fonts/${fontId}/characters.json`);
    pending.catch(() => charactersCache.delete(fontId));
    charactersCache.set(fontId, pending);
  }
  return pending;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function loadAssetImage(source: string): Promise<HTMLImageElement> {
  if (source.startsWith("data:")) return loadImage(source);
  let pending = imageCache.get(source);
  if (!pending) {
    pending = fetchAsset(source)
      .then((response) => response.blob())
      .then(readFileAsDataUrl)
      .then(loadImage);
    pending.catch(() => imageCache.delete(source));
    imageCache.set(source, pending);
  }
  return pending;
}

export const texturePath = (
  fontId: string,
  texture: string,
  variant: string | null,
) => `fonts/${fontId}/textures/${variant ?? texture}.png`;

export const overlayPath = (fontId: string, overlay: string) =>
  `fonts/${fontId}/overlays/${overlay}.png`;

export const fontOverlayPath = (fontId: string) =>
  `fonts/${fontId}/textures/overlay.png`;

export const thumbnailPath = (fontId: string, id: string) =>
  `fonts/${fontId}/thumbnails/${id}.png`;

export function tileablePath(tileable: Tileable, variant: string | null) {
  const path = variant
    ? (tileable.variants?.[variant]?.path ?? tileable.path)
    : tileable.path;
  return `tileables/${path ? `${path}/` : ""}${variant ?? tileable.id}.png`;
}
