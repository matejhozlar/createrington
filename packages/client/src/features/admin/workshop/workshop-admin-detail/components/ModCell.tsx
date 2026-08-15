import { CellText } from "@/components/cell-text";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";

export function ModCell({
  name,
  slug,
  thumbnailUrl,
}: {
  name: string;
  slug?: string | null;
  thumbnailUrl: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ProjectThumb
        name={name}
        thumbnailUrl={thumbnailUrl}
        className="size-8 shrink-0 rounded text-[11px]"
      />
      <div className="min-w-0">
        <CellText value={name} className="font-medium" />
        {slug && (
          <CellText value={slug} className="text-xs text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
