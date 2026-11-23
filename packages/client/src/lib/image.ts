interface LoadImageOptions {
  crossOrigin?: "anonymous";
}

export function loadImage(
  src: string,
  { crossOrigin }: LoadImageOptions = {},
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load image ${src.slice(0, 64)}`));
    image.src = src;
  });
}
