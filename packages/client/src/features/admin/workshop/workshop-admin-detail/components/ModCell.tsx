import { CellText } from "@/components/cell-text";
import { TwoLineCellSkeleton } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  DISABLED_BADGE_CLASS,
  DISABLED_LABEL,
  PROJECT_KIND_BADGE_CLASS,
  projectKindLabel,
} from "@/features/workshop/format";

export function ModCell({
  name,
  slug,
  thumbnailUrl,
  classId,
  required = true,
}: {
  name: string;
  slug?: string | null;
  thumbnailUrl: string | null;
  classId?: number;
  required?: boolean;
}) {
  const kind = classId === undefined ? null : projectKindLabel(classId);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ProjectThumb
        name={name}
        thumbnailUrl={thumbnailUrl}
        className="size-8 shrink-0 rounded text-[11px]"
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <CellText value={name} className="min-w-0 font-medium" />
          {kind && (
            <Badge variant="outline" className={PROJECT_KIND_BADGE_CLASS}>
              {kind}
            </Badge>
          )}
          {!required && (
            <Badge variant="outline" className={DISABLED_BADGE_CLASS}>
              {DISABLED_LABEL}
            </Badge>
          )}
        </div>
        {slug && (
          <CellText value={slug} className="text-xs text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

export function ModCellSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="size-8 shrink-0 rounded" />
      <TwoLineCellSkeleton />
    </div>
  );
}
