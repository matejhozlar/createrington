import { use } from "react";

interface Preload {
  promise: Promise<void>;
  done: boolean;
}

const cache = new Map<string, Preload>();

function preload(url: string): Preload {
  const existing = cache.get(url);
  if (existing) return existing;

  const entry: Preload = { done: false, promise: Promise.resolve() };
  entry.promise = new Promise<void>((resolve) => {
    const image = new Image();
    const finish = () => {
      entry.done = true;
      resolve();
    };
    image.onload = () =>
      image
        .decode()
        .catch(() => undefined)
        .then(finish);
    image.onerror = finish;
    image.src = url;
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
