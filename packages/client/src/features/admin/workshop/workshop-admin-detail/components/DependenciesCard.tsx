import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import { CardError } from "@/features/admin/components/CardState";
import { MOD_STATUS_STYLES } from "@/features/workshop/format";

type DependencyReport = RouterOutput["admin"]["workshops"]["dependencyReport"];

export function DependenciesCard({
  report,
  error,
  onRetry,
}: {
  report: DependencyReport | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <Card className="gap-0">
        <CardHeader className="gap-0 border-b">
          <CardTitle>Dependencies</CardTitle>
        </CardHeader>
        <CardError message={error} onRetry={onRetry} />
      </Card>
    );
  }

  if (!report) return null;

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>Dependencies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Pulled in as Dependencies ({report.pulled.length.toLocaleString()})
          </h3>
          {report.pulled.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <div className="space-y-1.5">
              {report.pulled.map((mod) => (
                <div key={mod.id} className="flex items-center gap-2.5 text-sm">
                  <ProjectThumb
                    name={mod.project.name}
                    thumbnailUrl={mod.project.thumbnailUrl}
                    className="size-7 rounded text-[10px]"
                  />
                  <span className="font-medium">{mod.project.name}</span>
                  {mod.requiredBy.length > 0 && (
                    <span className="text-muted-foreground">
                      required by{" "}
                      {mod.requiredBy
                        .map((required) => required.name)
                        .join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Optional Dependencies ({report.optional.length.toLocaleString()})
          </h3>
          {report.optional.length === 0 ? (
            <p className="text-sm text-muted-foreground">None detected.</p>
          ) : (
            <div className="space-y-1.5">
              {report.optional.map((dep) => (
                <div
                  key={dep.curseforgeProjectId}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <ProjectThumb
                    name={dep.name ?? ""}
                    thumbnailUrl={dep.thumbnailUrl}
                    className="size-7 rounded text-[10px]"
                  />
                  <span className="font-medium">
                    {dep.name ?? `Project #${dep.curseforgeProjectId}`}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    wanted by {dep.wantedBy.map((want) => want.name).join(", ")}
                  </span>
                  {dep.inWorkshop && (
                    <Badge variant="secondary" className="text-xs">
                      In the workshop
                    </Badge>
                  )}
                  {dep.rejected && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        MOD_STATUS_STYLES.rejected.className,
                      )}
                    >
                      {MOD_STATUS_STYLES.rejected.label}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
