import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ASPECTS = [
  16 / 9,
  4 / 3,
  16 / 9,
  3 / 2,
  16 / 9,
  4 / 3,
  16 / 10,
  16 / 9,
  3 / 2,
  16 / 9,
  4 / 3,
  16 / 9,
];

export function GalleryGridSkeleton() {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {SKELETON_ASPECTS.map((ratio, index) => (
        <div
          key={index}
          className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card"
        >
          <Skeleton
            className="w-full rounded-none"
            style={{ aspectRatio: ratio }}
          />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
