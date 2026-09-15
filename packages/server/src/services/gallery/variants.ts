import sharp from "sharp";

export interface ImageVariant {
  body: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
}

export interface GalleryVariants {
  full: ImageVariant;
  thumb: ImageVariant;
}

const FULL_MAX_EDGE = 2560;
const FULL_QUALITY = 82;
const THUMB_WIDTH = 640;
const THUMB_QUALITY = 75;

export async function createGalleryVariants(
  original: Buffer,
): Promise<GalleryVariants> {
  const source = sharp(original, { failOn: "error" }).rotate();

  const full = await source
    .clone()
    .resize({
      width: FULL_MAX_EDGE,
      height: FULL_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: FULL_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const thumb = await source
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    full: {
      body: full.data,
      width: full.info.width,
      height: full.info.height,
      contentType: "image/webp",
    },
    thumb: {
      body: thumb.data,
      width: thumb.info.width,
      height: thumb.info.height,
      contentType: "image/webp",
    },
  };
}
