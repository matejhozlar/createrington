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
  CardEmpty,
  CardError,
  CardLoading,
} from "@/features/admin/components/CardState";
import { MOD_STATUS_STYLES, formatDate } from "@/features/workshop/format";
import type { WorkshopModReviewAction } from "@createrington/shared/workshop";

export type AdminWorkshopMod =
  RouterOutput["admin"]["workshops"]["listMods"][number];

export function SuggestionsCard({
  mods,
  total,
  isLoading,
  error,
  onRetry,
  busyModId,
  onView,
  onReview,
  onReject,
}: {
  mods: AdminWorkshopMod[];
  total: number;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  busyModId: number | null;
  onView: (workshopModId: number) => void;
  onReview: (workshopModId: number, action: WorkshopModReviewAction) => void;
  onReject: (target: { workshopModId: number; name: string }) => void;
}) {
  return (
    <Card className="gap-0">
      <CardHeader className="gap-0 border-b">
        <CardTitle>Suggestions ({total.toLocaleString()})</CardTitle>
      </CardHeader>

      {isLoading ? (
        <CardLoading text="Loading suggestions..." />
      ) : error ? (
        <CardError message={error} onRetry={onRetry} />
      ) : mods.length === 0 ? (
        <CardEmpty icon={Lightbulb} message="No suggestions match this view" />
      ) : (
        <CardContent className="px-0">
          <Table>
            <TableHeader className="bg-sidebar-accent/50">
              <TableRow>
                <TableHead className="px-4">Mod</TableHead>
                <TableHead className="px-4">Submitted by</TableHead>
                <TableHead className="px-4">Note</TableHead>
                <TableHead className="px-4">
                  <Heart className="size-3.5" />
                </TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Date</TableHead>
                <TableHead className="px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mods.map((mod) => {
                const status = MOD_STATUS_STYLES[mod.status];
                const busy = busyModId === mod.id;
                return (
                  <TableRow key={mod.id}>
                    <TableCell className="px-4">
                      <button
                        type="button"
                        className="flex cursor-pointer items-center gap-2 text-left"
                        onClick={() => onView(mod.id)}
                      >
                        <ProjectThumb
                          name={mod.project.name}
                          thumbnailUrl={mod.project.thumbnailUrl}
                          className="size-8 rounded text-[11px]"
                        />
                        <div>
                          <p className="font-medium hover:underline">
                            {mod.project.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {mod.project.slug}
                          </p>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="px-4">
                      <PlayerLabel
                        name={mod.submitterName ?? mod.submittedBy}
                        playerId={mod.submittedBy}
                        size={20}
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate px-4 text-sm text-muted-foreground">
                      {mod.note ?? ""}
                    </TableCell>
                    <TableCell className="px-4 text-sm">
                      {mod.upvoteCount}
                    </TableCell>
                    <TableCell className="px-4">
                      {status && (
                        <Badge
                          variant="outline"
                          className={cn("text-xs", status.className)}
                        >
                          {status.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">
                      {formatDate(mod.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 text-right">
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
        </CardContent>
      )}
    </Card>
  );
}
