export const GALLERY_SUBMISSION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type GallerySubmissionStatus =
  (typeof GALLERY_SUBMISSION_STATUSES)[number];

export const GALLERY_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type GalleryImageContentType =
  (typeof GALLERY_IMAGE_CONTENT_TYPES)[number];

export const GALLERY_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;

export const GALLERY_MAX_CAPTION_LENGTH = 500;

export function galleryCaption(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  return trimmed.length > GALLERY_MAX_CAPTION_LENGTH
    ? trimmed.slice(0, GALLERY_MAX_CAPTION_LENGTH).trimEnd()
    : trimmed;
}
