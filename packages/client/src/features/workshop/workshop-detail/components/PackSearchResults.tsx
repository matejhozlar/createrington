import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PlayerLabel } from "@/components/player-label";
import { MOD_STATUS_STYLES, isHttpUrl } from "../../format";
import { ProjectThumb } from "../../components/ProjectThumb";
import { type PackMod } from "../../workshop-pack/components/PackList";

const ORIGIN_CREDITS: Partial<Record<PackMod["origin"], string>> = {
  dependency: "Required dependency",
  import: "Shipped with the pack",
};

function packCredit(row: PackMod): ReactNode {
  if (row.origin === "suggestion" && row.suggestedByName) {
    return (
      <>
        Suggested by <PlayerLabel name={row.suggestedByName} size={16} />
      </>
    );
  }
  if (row.origin === "dependency" && row.requiredBy.length > 0) {
    return `Required by ${row.requiredBy.map((r) => r.name).join(", ")}`;
  }
  if (row.origin === "import" && row.liveInVersion) {
    return `Added with ${row.liveInVersion}`;
  }
  return ORIGIN_CREDITS[row.origin] ?? null;
}

export function PackSearchResults({ mods }: { mods: PackMod[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Already in the pack
      </h3>
      {mods.map((row) => {
        const status = row.liveAt
          ? MOD_STATUS_STYLES.in_pack
          : MOD_STATUS_STYLES.next_update;
        const content = (
          <>
            <ProjectThumb
              name={row.project.name}
              thumbnailUrl={row.project.thumbnailUrl}
              className="size-9 rounded-lg text-xs"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {row.project.name}
                {row.project.primaryAuthor && (
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    by {row.project.primaryAuthor}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                {packCredit(row)}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn("shrink-0", status.className)}
            >
              {status.label}
            </Badge>
          </>
        );
        const rowClass =
          "flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 transition-colors";
        if (!isHttpUrl(row.project.websiteUrl)) {
          return (
            <div key={row.id} className={rowClass}>
              {content}
            </div>
          );
        }
        // Div, not <a>: the credit's PlayerLabel can itself be a link
        const open = () =>
          window.open(row.project.websiteUrl!, "_blank", "noopener,noreferrer");
        return (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
              }
            }}
            className={cn(
              rowClass,
              "cursor-pointer hover:border-primary/40 focus-visible:border-primary/40",
            )}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
