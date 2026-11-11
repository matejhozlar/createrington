import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonList() {
  return (
    <div className="space-y-1.5 px-2 py-2">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-7 w-3/4" />
    </div>
  );
}
