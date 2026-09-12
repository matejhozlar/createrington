import type { RouterOutput } from "@/lib/trpc";

export type GalleryItem =
  RouterOutput["public"]["gallery"]["list"]["items"][number];

export type GalleryCredit = GalleryItem["author"];

export const GALLERY_PAGE_SIZE = 24;

const DEFAULT_ASPECT_RATIO = 16 / 9;

export function aspectRatio(item: GalleryItem): number {
  if (!item.width || !item.height) return DEFAULT_ASPECT_RATIO;
  return item.width / item.height;
}

export function creditName(credit: GalleryCredit): string {
  return credit.minecraftUsername ?? "Unknown player";
}

export function altText(item: GalleryItem): string {
  return item.caption
    ? `${item.caption}, by ${creditName(item.author)}`
    : `Screenshot by ${creditName(item.author)}`;
}
