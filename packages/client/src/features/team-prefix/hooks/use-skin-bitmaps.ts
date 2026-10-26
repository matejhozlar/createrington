import { useEffect, useState } from "react";
import { bitmapOf, type Bitmap } from "../render/assets";
import { cachedImage } from "./use-loaded-image";

export function useSkinBitmaps(urls: readonly string[]): Map<string, Bitmap> {
  const [skins, setSkins] = useState<Map<string, Bitmap>>(() => new Map());
  const key = urls.join("\n");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(
      key.split("\n").map(async (url) => {
        const image = await cachedImage(url);
        return [url, bitmapOf(image)] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      setSkins(
        new Map(
          results.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          ),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return skins;
}
