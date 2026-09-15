import type { RouterOutput } from "@/lib/trpc";

export type GallerySubmissionItem =
  RouterOutput["admin"]["gallery"]["list"]["items"][number];
export type GallerySubmissionDetail = RouterOutput["admin"]["gallery"]["get"];
export type GalleryStatus = GallerySubmissionItem["status"];
export type GalleryCredit = GallerySubmissionItem["credits"][number];

export const GALLERY_STATUSES: GalleryStatus[] = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
];

export const GALLERY_STATUS_STYLES: Record<
  GalleryStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  },
  approved: {
    label: "Approved",
    className: "border-green-500/20 bg-green-500/10 text-green-400",
  },
  rejected: {
    label: "Rejected",
    className: "border-red-500/20 bg-red-500/10 text-red-400",
  },
  withdrawn: {
    label: "Withdrawn",
    className: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  },
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
