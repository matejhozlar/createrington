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

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

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
