import { useEffect, useState } from "react";
import { bitmapOf, headOf, type Bitmap } from "../render/assets";
import { cachedImage } from "./use-loaded-image";

export function useHeadBitmaps(urls: readonly string[]): Map<string, Bitmap> {
  const [heads, setHeads] = useState<Map<string, Bitmap>>(() => new Map());
  const key = urls.join("\n");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(
      key.split("\n").map(async (url) => {
        const image = await cachedImage(url);
        return [url, headOf(bitmapOf(image))] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      setHeads(
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

  return heads;
}
