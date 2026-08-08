import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Ban,
  Check,
  Eye,
  FlaskConical,
  Heart,
  Loader2,
  MoreHorizontal,
  PackagePlus,
  Settings2,
  Undo2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToastActions } from "@/hooks/use-toast";
import { useStickyValue } from "@/hooks/use-sticky-value";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/loading-spinner";
import { PlayerLabel } from "@/components/player-label";
import { ProjectThumb } from "@/features/workshop/components/ProjectThumb";
import { QueryErrorState } from "@/features/workshop/components/QueryErrorState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ModDetailDialog } from "@/features/workshop/workshop-detail/components/ModDetailDialog";
import {
  MOD_STATUS_STYLES,
  REJECT_REASON_LABELS,
  WORKSHOP_STATUS_STYLES,
  formatDate,
} from "@/features/workshop/format";
import {
  WORKSHOP_MOD_REJECT_REASONS,
  WORKSHOP_STATUS_TRANSITIONS,
} from "@createrington/shared/workshop";
import { AddModsDialog } from "./components/AddModsDialog";
import { WorkshopSettingsDialog } from "./components/WorkshopSettingsDialog";

type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "testing"
  | "next_update"
  | "in_pack"
  | "rejected";

type RejectReason = (typeof WORKSHOP_MOD_REJECT_REASONS)[number];

const ORIGIN_LABELS: Record<string, string> = {
  suggestion: "Suggestion",
  admin: "Admin Add",
  dependency: "Dependency",
  import: "Pack Import",
};

const ATTENTION_MESSAGES: Record<string, string> = {
  dropped_from_pack: "was live but is missing from the latest published pack.",
  shipped_unreviewed:
    "shipped in the pack but its suggestion never finished review, walk it through to coming next update to credit the suggester.",
  shipped_rejected: "shipped in the pack but is rejected in this workshop.",
};

const REVIEW_TOASTS: Record<string, string> = {
  approved: "Mod approved",
  testing: "Mod moved to testing",
  next_update: "Mod approved, coming next update",
  rejected: "Mod rejected",
};

const SEND_BACK_TOASTS: Record<string, string> = {
  approved: "Mod sent back, awaiting testing",
  testing: "Mod sent back to testing",
};

const STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "testing",
  "next_update",
  "in_pack",
  "rejected",
] as const;

export function AdminWorkshopDetail() {
  const { id } = useParams<{ id: string }>();
  const workshopId = Number(id);
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const workshopsQuery = trpc.admin.workshops.list.useQuery();
  const workshop = workshopsQuery.data?.find((v) => v.id === workshopId);

  const modsQuery = trpc.admin.workshops.listMods.useQuery(
    { workshopId },
    { enabled: Number.isFinite(workshopId) },
  );
  const depReportQuery = trpc.admin.workshops.dependencyReport.useQuery(
    { workshopId },
    { enabled: Number.isFinite(workshopId) },
  );
  const packModsQuery = trpc.admin.workshops.listPackMods.useQuery(
    { workshopId },
    { enabled: Number.isFinite(workshopId) },
  );
  const attentionQuery = trpc.admin.workshops.getAttention.useQuery(
    { workshopId },
    { enabled: Number.isFinite(workshopId) },
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailModId, setDetailModId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<{
    workshopModId: number;
    name: string;
  } | null>(null);
  const displayRejectTarget = useStickyValue(rejectTarget);
  const [removeTarget, setRemoveTarget] = useState<{
    modpackModId: number;
    name: string;
  } | null>(null);
  const displayRemoveTarget = useStickyValue(removeTarget);
  const [rejectReason, setRejectReason] = useState<RejectReason | "">("");
  const [rejectNote, setRejectNote] = useState("");

  const invalidate = () => {
    utils.admin.workshops.listMods.invalidate({ workshopId });
    utils.admin.workshops.getMod.invalidate();
    utils.admin.workshops.searchProjects.invalidate({ workshopId });
    utils.admin.workshops.dependencyReport.invalidate({ workshopId });
    utils.admin.workshops.listPackMods.invalidate({ workshopId });
    utils.admin.workshops.getAttention.invalidate({ workshopId });
    utils.user.workshops.list.invalidate();
    utils.user.workshops.get.invalidate();
    utils.user.workshops.listRejected.invalidate({ workshopId });
    utils.user.workshops.getPack.invalidate({ workshopId });
  };

  const removePackModMutation = trpc.admin.modpacks.removeMod.useMutation({
    onSuccess: () => {
      toast.success("Removed from the pack");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewMutation = trpc.admin.workshops.reviewMod.useMutation({
    onSuccess: (mod, variables) => {
      const toasts =
        variables.action === "send_back" ? SEND_BACK_TOASTS : REVIEW_TOASTS;
      toast.success(toasts[mod.status] ?? "Mod updated");
      invalidate();
      setRejectTarget(null);
      setRejectReason("");
      setRejectNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateWorkshopMutation = trpc.admin.workshops.update.useMutation({
    onSuccess: () => {
      toast.success("Workshop updated");
      utils.admin.workshops.list.invalidate();
      utils.user.workshops.list.invalidate();
      utils.user.workshops.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const mods = useMemo(() => modsQuery.data ?? [], [modsQuery.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: mods.length,
      pending: 0,
      approved: 0,
      testing: 0,
      next_update: 0,
      in_pack: 0,
      rejected: 0,
    };
    for (const mod of mods) c[mod.status] = (c[mod.status] ?? 0) + 1;
    return c;
  }, [mods]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? mods
        : mods.filter((m) => m.status === statusFilter),
    [mods, statusFilter],
  );

  if (workshopsQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loading size="medium" text="Loading workshop..." />
      </div>
    );
  }

  if (workshopsQuery.error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <QueryErrorState
          message={workshopsQuery.error.message}
          onRetry={() => workshopsQuery.refetch()}
        />
      </div>
    );
  }

  if (!workshop) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Workshop not found
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop", href: "/admin/tools/workshop" },
          { label: workshop.name },
        ]}
      >
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={workshop.status}
            disabled={updateWorkshopMutation.isPending}
            onValueChange={(status) =>
              updateWorkshopMutation.mutate({
                workshopId,
                patch: { status: status as typeof workshop.status },
              })
            }
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                workshop.status,
                ...WORKSHOP_STATUS_TRANSITIONS[workshop.status],
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {WORKSHOP_STATUS_STYLES[s]?.label ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSettingsKey((key) => key + 1);
              setSettingsOpen(true);
            }}
          >
            <Settings2 className="size-4" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PackagePlus className="size-4" />
            Add Mods
          </Button>
        </div>
      </AdminPageHeader>

      <div className="mx-auto w-full max-w-[1100px] flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All" : MOD_STATUS_STYLES[status].label}
              <Badge variant="outline" className="ml-1.5 text-xs">
                {counts[status] ?? 0}
              </Badge>
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {modsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="medium" text="Loading mods..." />
              </div>
            ) : modsQuery.error ? (
              <QueryErrorState
                compact
                message={modsQuery.error.message}
                onRetry={() => modsQuery.refetch()}
              />
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No mods
                {statusFilter !== "all" && ` with status ${statusFilter}`}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mod</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>
                      <Heart className="size-3.5" />
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((mod) => {
                    const status = MOD_STATUS_STYLES[mod.status];
                    const busy =
                      reviewMutation.isPending &&
                      reviewMutation.variables?.workshopModId === mod.id;
                    return (
                      <TableRow key={mod.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="flex cursor-pointer items-center gap-2 text-left"
                            onClick={() => setDetailModId(mod.id)}
                          >
                            <ProjectThumb
                              name={mod.project.name}
                              thumbnailUrl={mod.project.thumbnailUrl}
                              className="size-8 rounded text-[11px]"
                            />
                            <div>
                              <div className="font-medium hover:underline">
                                {mod.project.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {mod.project.slug}
                              </div>
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
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {mod.note ?? ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {mod.upvoteCount}
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
                              <DropdownMenuItem
                                onClick={() => setDetailModId(mod.id)}
                              >
                                <Eye className="size-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(mod.status === "pending" ||
                                mod.status === "rejected") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      workshopModId: mod.id,
                                      action: "approve",
                                    })
                                  }
                                >
                                  <Check className="size-4 text-green-500" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {mod.status === "approved" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      workshopModId: mod.id,
                                      action: "start_testing",
                                    })
                                  }
                                >
                                  <FlaskConical className="size-4 text-amber-400" />
                                  Start Testing
                                </DropdownMenuItem>
                              )}
                              {mod.status === "testing" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      workshopModId: mod.id,
                                      action: "approve",
                                    })
                                  }
                                >
                                  <Check className="size-4 text-green-500" />
                                  Approve for Next Update
                                </DropdownMenuItem>
                              )}
                              {(mod.status === "testing" ||
                                mod.status === "next_update") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      workshopModId: mod.id,
                                      action: "send_back",
                                    })
                                  }
                                >
                                  <Undo2 className="size-4 text-muted-foreground" />
                                  Send Back a Stage
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setRejectTarget({
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
            )}
          </CardContent>
        </Card>

        {attentionQuery.error && (
          <Card>
            <CardContent className="pt-6">
              <QueryErrorState
                compact
                message={attentionQuery.error.message}
                onRetry={() => attentionQuery.refetch()}
              />
            </CardContent>
          </Card>
        )}

        {(attentionQuery.data?.length ?? 0) > 0 && (
          <Card className="border-amber-500/40">
            <CardContent className="space-y-2 pt-6">
              <h3 className="text-sm font-semibold">Needs Attention</h3>
              {attentionQuery.data!.map((item) => (
                <div
                  key={`${item.type}-${item.curseforgeProjectId}`}
                  className="text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {item.name}
                  </span>{" "}
                  {item.type === "rejected_dependency" ||
                  item.type === "unpromoted_dependency" ? (
                    <>
                      is required by{" "}
                      <span className="font-medium text-foreground">
                        {item.requiredByName}
                      </span>{" "}
                      {item.type === "rejected_dependency"
                        ? "but is rejected in this workshop."
                        : "but has not reached the pack yet, so the pack is missing it."}
                    </>
                  ) : (
                    ATTENTION_MESSAGES[item.type]
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold">Modpack Members</h3>
            {packModsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loading size="medium" text="Loading pack members..." />
              </div>
            ) : packModsQuery.error ? (
              <QueryErrorState
                compact
                message={packModsQuery.error.message}
                onRetry={() => packModsQuery.refetch()}
              />
            ) : (packModsQuery.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nothing in the pack yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mod</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packModsQuery.data?.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ProjectThumb
                            name={row.project.name}
                            thumbnailUrl={row.project.thumbnailUrl}
                            className="size-8 rounded text-[11px]"
                          />
                          <div>
                            <div className="font-medium">
                              {row.project.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.project.slug}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ORIGIN_LABELS[row.origin] ?? row.origin}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.origin === "suggestion" &&
                          (row.suggestedByName ? (
                            <span className="flex items-center gap-1">
                              Suggested by{" "}
                              <PlayerLabel
                                name={row.suggestedByName}
                                size={16}
                              />
                            </span>
                          ) : (
                            "Suggested by a player"
                          ))}
                        {row.origin === "admin" &&
                          (row.addedByName ? (
                            <span className="flex items-center gap-1">
                              Added by{" "}
                              <PlayerLabel
                                name={row.addedByName}
                                playerId={row.addedBy}
                                size={16}
                              />
                            </span>
                          ) : (
                            "Added by an admin"
                          ))}
                        {row.origin === "dependency" &&
                          (row.requiredBy.length > 0
                            ? `Required by ${row.requiredBy.map((r) => r.name).join(", ")}`
                            : "Required dependency")}
                        {row.origin === "import" &&
                          (row.liveInVersion
                            ? `Added with ${row.liveInVersion}`
                            : "From the published pack")}
                      </TableCell>
                      <TableCell>
                        {row.liveAt ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              MOD_STATUS_STYLES.live.className,
                            )}
                          >
                            {row.liveInVersion
                              ? `Live · ${row.liveInVersion}`
                              : "Live"}
                          </Badge>
                        ) : row.droppedFromManifestAt ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-400"
                          >
                            Missing from pack
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              MOD_STATUS_STYLES.next_update.className,
                            )}
                          >
                            {MOD_STATUS_STYLES.next_update.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.origin !== "suggestion" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removePackModMutation.isPending}
                            onClick={() =>
                              setRemoveTarget({
                                modpackModId: row.id,
                                name: row.project.name,
                              })
                            }
                          >
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {depReportQuery.error && (
          <Card>
            <CardContent className="pt-6">
              <QueryErrorState
                compact
                message={depReportQuery.error.message}
                onRetry={() => depReportQuery.refetch()}
              />
            </CardContent>
          </Card>
        )}

        {depReportQuery.data && (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Pulled in as Dependencies
                </h3>
                {depReportQuery.data.pulled.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {depReportQuery.data.pulled.map((mod) => (
                      <div
                        key={mod.id}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <ProjectThumb
                          name={mod.project.name}
                          thumbnailUrl={mod.project.thumbnailUrl}
                          className="size-7 rounded text-[10px]"
                        />
                        <span className="font-medium">{mod.project.name}</span>
                        {mod.requiredBy.length > 0 && (
                          <span className="text-muted-foreground">
                            required by{" "}
                            {mod.requiredBy.map((m) => m.name).join(", ")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Optional Dependencies
                </h3>
                {depReportQuery.data.optional.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    None detected.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {depReportQuery.data.optional.map((dep) => (
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
                          wanted by {dep.wantedBy.map((w) => w.name).join(", ")}
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
        )}
      </div>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove &quot;{displayRemoveTarget?.name}&quot; from the pack?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The mod will be dropped from the next pack build. You can add it
              back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removePackModMutation.isPending}
              onClick={() => {
                if (removeTarget) {
                  removePackModMutation.mutate({
                    modpackModId: removeTarget.modpackModId,
                  });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ModDetailDialog
        workshopModId={detailModId}
        onOpenChange={(open) => !open && setDetailModId(null)}
        admin
      />

      <AddModsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        workshopId={workshopId}
        onAdded={invalidate}
      />

      <WorkshopSettingsDialog
        key={settingsKey}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workshop={workshop}
        hasMods={mods.length > 0}
      />

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
            setRejectNote("");
          }
        }}
      >
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Reject {displayRejectTarget?.name}?</DialogTitle>
            <DialogDescription>
              Rejecting rules this mod out of this workshop. The entry stays
              visible with the reason, and you can re-review it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select
                value={rejectReason}
                onValueChange={(value) =>
                  setRejectReason(value as RejectReason)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REJECT_REASON_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-note">Note (Optional)</Label>
              <Input
                id="reject-note"
                placeholder="Extra context, shown to players."
                maxLength={500}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() =>
                displayRejectTarget &&
                reviewMutation.mutate({
                  workshopModId: displayRejectTarget.workshopModId,
                  action: "reject",
                  reason: rejectReason === "" ? undefined : rejectReason,
                  note: rejectNote.trim() || undefined,
                })
              }
              disabled={reviewMutation.isPending || !rejectReason}
            >
              {reviewMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
