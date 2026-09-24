export interface RgbaImage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function opaqueBox(image: RgbaImage): Box | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return maxX < 0
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function outlineOffset(
  plain: RgbaImage,
  outlined: RgbaImage,
): { x: number; y: number } | null {
  const inner = opaqueBox(plain);
  const outer = opaqueBox(outlined);
  if (!inner || !outer) return null;

  const thicknessX = (outer.width - inner.width) / 2;
  const thicknessY = (outer.height - inner.height) / 2;
  if (
    thicknessX <= 0 ||
    !Number.isInteger(thicknessX) ||
    thicknessX !== thicknessY
  ) {
    return null;
  }

  const x = outer.x + thicknessX - inner.x;
  const y = outer.y + thicknessY - inner.y;
  const fits =
    x >= 0 &&
    y >= 0 &&
    x + plain.width <= outlined.width &&
    y + plain.height <= outlined.height;
  return fits ? { x, y } : null;
}
