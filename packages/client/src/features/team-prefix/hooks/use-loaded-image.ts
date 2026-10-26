import { useEffect, useState } from "react";
import { loadImage } from "@/lib/skin-runner/skin";

const cache = new Map<string, Promise<HTMLImageElement>>();

export function cachedImage(src: string): Promise<HTMLImageElement> {
  let image = cache.get(src);
  if (!image) {
    image = loadImage(src);
    image.catch(() => cache.delete(src));
    cache.set(src, image);
  }
  return image;
}

export function useLoadedImage(src: string | null): HTMLImageElement | null {
  const [loaded, setLoaded] = useState<{
    src: string;
    image: HTMLImageElement;
  } | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    cachedImage(src).then(
      (image) => {
        if (!cancelled) setLoaded({ src, image });
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [src]);

  return loaded && loaded.src === src ? loaded.image : null;
}
