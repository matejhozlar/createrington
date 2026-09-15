import { objectStorage } from "@/services/storage";
import type { GallerySubmission } from "@createrington/shared/db";

export interface GalleryImageUrls {
  full: string;
  thumb: string;
}

export function galleryImageUrls(
  submission: Pick<GallerySubmission, "fullKey" | "thumbKey">,
): GalleryImageUrls | null {
  if (!submission.fullKey || !submission.thumbKey) return null;

  return {
    full: objectStorage.publicUrl(submission.fullKey),
    thumb: objectStorage.publicUrl(submission.thumbKey),
  };
}
