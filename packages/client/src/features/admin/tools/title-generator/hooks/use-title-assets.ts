import { useQuery } from "@tanstack/react-query";
import {
  loadAssetImage,
  loadCatalog,
  loadCharacters,
  loadFontTextures,
  tileablePath,
} from "../engine/assets";
import type { Tileable } from "../engine/types";

const KEY = "title-generator";

export function useTitleCatalog() {
  return useQuery({
    queryKey: [KEY, "catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useFontTextures(fontId: string) {
  return useQuery({
    queryKey: [KEY, "textures", fontId],
    queryFn: () => loadFontTextures(fontId),
    staleTime: Infinity,
  });
}

export function useFontCharacters(fontId: string) {
  return useQuery({
    queryKey: [KEY, "characters", fontId],
    queryFn: () => loadCharacters(fontId),
    staleTime: Infinity,
  });
}

export function useImageSize(source: string | null) {
  return useQuery({
    queryKey: [KEY, "image-size", source],
    queryFn: async () => {
      const img = await loadAssetImage(source!);
      return { width: img.width, height: img.height };
    },
    enabled: !!source,
    staleTime: Infinity,
  });
}

export function tileableSource(
  tileables: Tileable[],
  id: string,
  variant: string | null,
) {
  const tileable = tileables.find((entry) => entry.id === id);
  return tileable ? tileablePath(tileable, variant) : null;
}
