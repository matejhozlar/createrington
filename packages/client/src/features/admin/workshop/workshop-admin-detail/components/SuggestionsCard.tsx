import {
  Ban,
  Check,
  Eye,
  FlaskConical,
  Heart,
  Lightbulb,
  Loader2,
  MoreHorizontal,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RouterOutput } from "@/lib/trpc";
import { Paginator } from "@/components/paginator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerLabel } from "@/components/player-label";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import {
  DEPENDENCY_COVERAGE_STYLES,
  MOD_STATUS_STYLES,
  dependencyIsCovered,
  formatDate,
} from "@/features/workshop/format";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";

export type AdminWorkshopMod =
  RouterOutput["admin"]["workshops"]["listMods"][number];

const REQUIRED_DEPENDENCY = 3;
const SUGGESTIONS_PER_PAGE = 10;

function DependencyCell({ mod }: { mod: AdminWorkshopMod }) {
  const required = mod.dependencies.filter(
    (dep) => dep.relationType === REQUIRED_DEPENDENCY,
  );
  const optional = mod.dependencies.filter(
    (dep) => dep.relationType !== REQUIRED_DEPENDENCY,
  );
  const uncovered = required.filter(
    (dep) => !dependencyIsCovered(dep.coverage),
  );
  if (mod.dependencies.length === 0) {
    return <span className="text-xs text-muted-foreground">None</span>;
  }
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

export function SuggestionsCard({
  mods,
  total,
  filtered,
  isLoading,
  error,
  onRetry,
  page: requestedPage,
  onPageChange,
  busyModId,
  onView,
  onReview,
  onReject,
}: {
  mods: AdminWorkshopMod[];
  total: number;
  filtered: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  page: number;
  onPageChange: (page: number) => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
  onReview: (workshopModId: number, action: WorkshopModReviewAction) => void;
  onReject: (target: { workshopModId: number; name: string }) => void;
}) {
  const totalPages = Math.ceil(mods.length / SUGGESTIONS_PER_PAGE);
  const page = Math.min(requestedPage, Math.max(0, totalPages - 1));
  const visible = mods.slice(
    page * SUGGESTIONS_PER_PAGE,
    (page + 1) * SUGGESTIONS_PER_PAGE,
  );

  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>
          Suggestions (
          {filtered
            ? `${mods.length.toLocaleString()} of ${total.toLocaleString()}`
            : total.toLocaleString()}
          )
        </CardTitle>
      </CardHeader>

      {isLoading ? (
        <CardLoading text="Loading suggestions..." />
      ) : error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : mods.length === 0 ? (
        <CardEmpty icon={Lightbulb} message="No suggestions match this view" />
      ) : (
        <CardContent className="px-0">
          <Table className="min-w-[1118px]">
            <TableHeader>
              <TableRow>
                <TableHead>Mod</TableHead>
                <TableHead col="player">Submitted by</TableHead>
                <TableHead className="w-[180px]">Note</TableHead>
                <TableHead col="index" className="text-center">
                  <Heart className="mx-auto size-3.5" />
                </TableHead>
                <TableHead col="count" className="text-center">
                  Pulls In
                </TableHead>
                <TableHead col="statusWide">Status</TableHead>
                <TableHead col="date">Date</TableHead>
                <TableHead actions={1} className="text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((mod) => {
                const status = MOD_STATUS_STYLES[mod.status];
                const busy = busyModId === mod.id;
                return (
                  <TableRow key={mod.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 text-left"
                        onClick={() => onView(mod.id)}
                      >
                        <ProjectThumb
                          name={mod.project.name}
                          thumbnailUrl={mod.project.thumbnailUrl}
                          className="size-8 shrink-0 rounded text-[11px]"
                        />
                        <div className="min-w-0">
                          <p
                            className="truncate font-medium hover:underline"
                            title={mod.project.name}
                          >
                            {mod.project.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {mod.project.slug}
                          </p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <PlayerLabel
                        name={mod.submitterName ?? mod.submittedBy}
                        playerId={mod.submittedBy}
                        size={20}
                      />
                    </TableCell>
                    <TableCell
                      className="text-sm text-muted-foreground"
                      title={mod.note ?? undefined}
                    >
                      {mod.note ?? ""}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {mod.upvoteCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <DependencyCell mod={mod} />
                    </TableCell>
                    <TableCell>
                      {status && (
                        <Badge
                          variant="outline"
                          className={cn("text-xs", status.className)}
                        >
                          {status.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(mod.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={busy}
                          >
                            {busy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(mod.id)}>
                            <Eye className="size-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(mod.status === "pending" ||
                            mod.status === "rejected") && (
                            <DropdownMenuItem
                              onClick={() => onReview(mod.id, "approve")}
                            >
                              <Check className="size-4 text-green-500" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {mod.status === "approved" && (
                            <DropdownMenuItem
                              onClick={() => onReview(mod.id, "start_testing")}
                            >
                              <FlaskConical className="size-4 text-amber-400" />
                              Start Testing
                            </DropdownMenuItem>
                          )}
                          {mod.status === "testing" && (
                            <DropdownMenuItem
                              onClick={() => onReview(mod.id, "approve")}
                            >
                              <Check className="size-4 text-green-500" />
                              Approve for Next Update
                            </DropdownMenuItem>
                          )}
                          {(mod.status === "testing" ||
                            mod.status === "next_update") && (
                            <DropdownMenuItem
                              onClick={() => onReview(mod.id, "send_back")}
                            >
                              <Undo2 className="size-4 text-muted-foreground" />
                              Send Back a Stage
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              onReject({
                                workshopModId: mod.id,
                                name: mod.project.name,
                              })
                            }
                          >
                            <Ban className="size-4" />
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Paginator
            page={page}
            limit={SUGGESTIONS_PER_PAGE}
            total={mods.length}
            totalPages={totalPages}
            onPageChange={onPageChange}
            itemLabel="suggestion"
            className="px-4 pt-4"
          />
        </CardContent>
      )}
    </Card>
  );
}
