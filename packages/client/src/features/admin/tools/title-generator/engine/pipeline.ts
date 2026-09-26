import { loadCharacters, type Catalog } from "./assets";
import { buildTitleMesh, normalizeTitleText } from "./geometry";
import type { PreparedLayer } from "./render";
import { geometryOptions, resolveTextureArgs } from "./settings";
import { makeTexture } from "./texture";
import type { TitleLayer } from "./types";

const TEXTURE_CACHE_LIMIT = 24;

const textureCache = new Map<string, Promise<HTMLCanvasElement>>();

const uploadIds = new Map<string, number>();

function uploadKey(dataUrl: string | null) {
  if (!dataUrl) return null;
  let id = uploadIds.get(dataUrl);
  if (id === undefined) {
    id = uploadIds.size;
    uploadIds.set(dataUrl, id);
  }
  return `upload-${id}`;
}

function cachedTexture(layer: TitleLayer, catalog: Catalog) {
  const args = resolveTextureArgs(layer);
  const key = JSON.stringify({
    ...args,
    customTexture: uploadKey(args.customTexture),
    customOverlay: uploadKey(args.customOverlay),
  });
  let pending = textureCache.get(key);
  if (pending) {
    textureCache.delete(key);
  } else {
    pending = makeTexture(args, catalog.fonts[layer.font], catalog.tileables);
    pending.catch(() => textureCache.delete(key));
  }
  textureCache.set(key, pending);
  while (textureCache.size > TEXTURE_CACHE_LIMIT) {
    const oldest = textureCache.keys().next().value;
    if (oldest === undefined) break;
    textureCache.delete(oldest);
  }
  return pending;
}

export function getLayerTexture(layer: TitleLayer, catalog: Catalog) {
  return cachedTexture(layer, catalog);
}

export async function prepareLayers(
  layers: TitleLayer[],
  catalog: Catalog,
): Promise<PreparedLayer[]> {
  const prepared = await Promise.all(
    layers.map(async (layer): Promise<PreparedLayer | null> => {
      const font = catalog.fonts[layer.font];
      const text = normalizeTitleText(layer.text);
      if (!font || !text) return null;
      const [characters, texture] = await Promise.all([
        loadCharacters(font.id),
        cachedTexture(layer, catalog),
      ]);
      const mesh = buildTitleMesh(
        text,
        font,
        characters,
        geometryOptions(layer),
      );
      return mesh.cubes.length ? { mesh, texture } : null;
    }),
  );
  return prepared.filter((layer): layer is PreparedLayer => layer !== null);
}
