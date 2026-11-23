import { use } from "react";
import { loadImage } from "@/lib/image";

interface Preload {
  promise: Promise<void>;
  done: boolean;
}

const cache = new Map<string, Preload>();

function preload(url: string): Preload {
  const existing = cache.get(url);
  if (existing) return existing;

  const entry: Preload = { done: false, promise: Promise.resolve() };
  entry.promise = loadImage(url)
    .then((image) => image.decode())
    .catch(() => undefined)
    .then(() => {
      entry.done = true;
    });
  cache.set(url, entry);
  return entry;
}

export function usePreloadedImages(urls: string[]): void {
  for (const url of urls) {
    const entry = preload(url);
    if (!entry.done) use(entry.promise);
  }
}
