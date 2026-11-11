import type { BadgeTone } from "@/components/ui/badge";
import type { RouterOutput } from "@/lib/trpc";

export type GallerySubmissionItem =
  RouterOutput["admin"]["gallery"]["list"]["items"][number];
export type GallerySubmissionDetail = RouterOutput["admin"]["gallery"]["get"];
export type GalleryStatus = GallerySubmissionItem["status"];
export type GalleryCredit = GallerySubmissionItem["credits"][number];

export const GALLERY_STATUS: Record<
  GalleryStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export function formatDimensions(
  width: number | null,
  height: number | null,
): string | null {
  if (!width || !height) return null;
  return `${width} x ${height}`;
}

export function apiPath(url: string): string {
  return url.startsWith("/") ? url.slice(1) : url;
}
