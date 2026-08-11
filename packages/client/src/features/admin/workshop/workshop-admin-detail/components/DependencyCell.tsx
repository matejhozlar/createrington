import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  DEPENDENCY_COVERAGE_STYLES,
  dependencyIsCovered,
} from "@/features/workshop/format";
import { REQUIRED_DEPENDENCY } from "@createrington/shared/workshop";
import type { AdminWorkshopMod } from "../types";

export function DependencyCell({ mod }: { mod: AdminWorkshopMod }) {
  const required = mod.dependencies.filter(
    (dep) => dep.relationType === REQUIRED_DEPENDENCY,
  );
  const optional = mod.dependencies.filter(
    (dep) => dep.relationType !== REQUIRED_DEPENDENCY,
  );
  const uncovered = required.filter(
    (dep) => !dependencyIsCovered(dep.coverage),
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          <Badge
            variant="outline"
            className={cn(
              "text-xs transition-colors hover:brightness-125",
              uncovered.length > 0
                ? "border-amber-500/20 bg-amber-500/10 text-amber-400"
                : "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
            )}
          >
            {uncovered.length > 0
              ? `+${uncovered.length}`
              : `${mod.dependencies.length}`}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        {[
          { label: "Required", deps: required },
          { label: "Optional", deps: optional },
        ]
          .filter((group) => group.deps.length > 0)
          .map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                {group.label}
              </p>
              {group.deps.map((dep) => (
                <div
                  key={dep.curseforgeProjectId}
                  className="flex items-center gap-2 text-sm"
                >
                  <ProjectThumb
                    name={dep.name ?? ""}
                    thumbnailUrl={dep.thumbnailUrl}
                    className="size-6 rounded text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      {dep.name ?? `Project #${dep.curseforgeProjectId}`}
                    </p>
                    {dep.requiredByCount > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Wanted by {dep.requiredByCount} mods
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-xs",
                      DEPENDENCY_COVERAGE_STYLES[dep.coverage]?.className,
                    )}
                  >
                    {DEPENDENCY_COVERAGE_STYLES[dep.coverage]?.label ??
                      dep.coverage}
                  </Badge>
                </div>
              ))}
            </div>
          ))}
      </PopoverContent>
    </Popover>
  );
}
