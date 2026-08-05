import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Ban,
  Check,
  Eye,
  Heart,
  Loader2,
  MoreHorizontal,
  PackagePlus,
  Settings2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useStickyValue } from "@/hooks/use-sticky-value";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PlayerLabel } from "@/components/player-label";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ModDetailDialog } from "@/features/workshop/workshop-detail/components/ModDetailDialog";
import {
  MOD_STATUS_STYLES,
  REJECT_REASON_LABELS,
  formatDate,
} from "@/features/workshop/format";
import { WORKSHOP_MOD_REJECT_REASONS } from "@createrington/shared/workshop";
import { AddModsDialog } from "./components/AddModsDialog";
import { WorkshopSettingsDialog } from "./components/WorkshopSettingsDialog";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

type RejectReason = (typeof WORKSHOP_MOD_REJECT_REASONS)[number];

const WORKSHOP_STATUSES = ["draft", "open", "closed", "archived"] as const;

const ORIGIN_LABELS: Record<string, string> = {
  suggestion: "Suggestion",
  admin: "Admin add",
  dependency: "Dependency",
  import: "Pack import",
};

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
  const attentionQuery = trpc.admin.workshops.attention.useQuery(
    { workshopId },
    { enabled: Number.isFinite(workshopId) },
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailModId, setDetailModId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{
    workshopModId: number;
    name: string;
  } | null>(null);
  const displayRejectTarget = useStickyValue(rejectTarget);
  const [rejectReason, setRejectReason] = useState<RejectReason | "">("");
  const [rejectNote, setRejectNote] = useState("");

  const invalidate = () => {
    utils.admin.workshops.listMods.invalidate({ workshopId });
    utils.admin.workshops.getMod.invalidate();
    utils.admin.workshops.searchProjects.invalidate({ workshopId });
    utils.admin.workshops.dependencyReport.invalidate({ workshopId });
    utils.admin.workshops.listPackMods.invalidate({ workshopId });
    utils.admin.workshops.attention.invalidate({ workshopId });
    utils.user.workshops.get.invalidate();
    utils.user.workshops.listRejected.invalidate({ workshopId });
    utils.user.workshops.pack.invalidate({ workshopId });
  };

  const removePackModMutation = trpc.admin.modpacks.removeMod.useMutation({
    onSuccess: () => {
      toast.success("Removed from the pack");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reconcileMutation = trpc.admin.modpacks.reconcile.useMutation({
    onSuccess: () => {
      toast.success("Checked against the published pack");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reviewMutation = trpc.admin.workshops.reviewMod.useMutation({
    onSuccess: (_mod, variables) => {
      toast.success(
        `Mod ${variables.action === "approve" ? "approved" : "rejected"}`,
      );
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
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
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
            onValueChange={(status) =>
              updateWorkshopMutation.mutate({
                workshopId,
                patch: { status: status as (typeof WORKSHOP_STATUSES)[number] },
              })
            }
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKSHOP_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-4" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PackagePlus className="size-4" />
            Add mods
          </Button>
        </div>
      </AdminPageHeader>

      <div className="mx-auto w-full max-w-[1100px] flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map(
            (status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === "all"
                  ? "All"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
                <Badge variant="outline" className="ml-1.5 text-xs">
                  {counts[status] ?? 0}
                </Badge>
              </Button>
            ),
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {modsQuery.isLoading ? (
              <Skeleton className="h-48 w-full" />
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
                            {mod.project.thumbnailUrl && (
                              <img
                                src={mod.project.thumbnailUrl}
                                alt=""
                                className="size-8 rounded"
                              />
                            )}
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
                              className={`text-xs ${status.className}`}
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
                                View details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {mod.status !== "approved" && (
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

        {(attentionQuery.data?.length ?? 0) > 0 && (
          <Card className="border-amber-500/40">
            <CardContent className="space-y-2 pt-6">
              <h3 className="text-sm font-semibold">Needs attention</h3>
              {attentionQuery.data!.map((item) => (
                <div
                  key={`${item.type}-${item.curseforgeProjectId}`}
                  className="text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {item.name}
                  </span>{" "}
                  {item.type === "dropped_from_pack" &&
                    "was live but is missing from the latest published pack."}
                  {item.type === "shipped_unreviewed" &&
                    "shipped in the pack but its suggestion is unreviewed, approve it to credit the suggester."}
                  {item.type === "shipped_rejected" &&
                    "shipped in the pack but is rejected in this workshop."}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Modpack members</h3>
              <Button
                variant="outline"
                size="sm"
                disabled={reconcileMutation.isPending || !workshop}
                onClick={() =>
                  workshop &&
                  reconcileMutation.mutate({ modpackId: workshop.modpackId })
                }
              >
                {reconcileMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Check published pack
              </Button>
            </div>
            {packModsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
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
                          {row.project.thumbnailUrl && (
                            <img
                              src={row.project.thumbnailUrl}
                              alt=""
                              className="size-8 rounded"
                            />
                          )}
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
                              suggested by{" "}
                              <PlayerLabel
                                name={row.suggestedByName}
                                size={16}
                              />
                            </span>
                          ) : (
                            "suggested by a player"
                          ))}
                        {row.origin === "admin" &&
                          (row.addedByName ? (
                            <span className="flex items-center gap-1">
                              added by{" "}
                              <PlayerLabel
                                name={row.addedByName}
                                playerId={row.addedBy}
                                size={16}
                              />
                            </span>
                          ) : (
                            `added by ${row.addedBy ?? "an admin"}`
                          ))}
                        {row.origin === "dependency" &&
                          (row.requiredBy.length > 0
                            ? `required by ${row.requiredBy.map((r) => r.name).join(", ")}`
                            : "required dependency")}
                        {row.origin === "import" &&
                          (row.liveInVersion
                            ? `added with ${row.liveInVersion}`
                            : "from the published pack")}
                      </TableCell>
                      <TableCell>
                        {row.liveAt ? (
                          <Badge
                            variant="outline"
                            className="border-green-500/50 bg-green-500/10 text-xs text-green-400"
                          >
                            {row.liveInVersion
                              ? `Live · ${row.liveInVersion}`
                              : "Live"}
                          </Badge>
                        ) : row.droppedFromManifestAt ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 bg-amber-500/10 text-xs text-amber-400"
                          >
                            Missing from pack
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-sky-500/50 bg-sky-500/10 text-xs text-sky-400"
                          >
                            Coming next update
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
                              removePackModMutation.mutate({
                                modpackModId: row.id,
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

        {depReportQuery.data && (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Pulled in as dependencies
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
                        {mod.project.thumbnailUrl ? (
                          <img
                            src={mod.project.thumbnailUrl}
                            alt=""
                            className="size-7 rounded"
                          />
                        ) : (
                          <div className="size-7 rounded bg-accent" />
                        )}
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
                  Optional dependencies
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
                        {dep.thumbnailUrl ? (
                          <img
                            src={dep.thumbnailUrl}
                            alt=""
                            className="size-7 rounded"
                          />
                        ) : (
                          <div className="size-7 rounded bg-accent" />
                        )}
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
                            className="border-red-500/50 text-xs text-red-400"
                          >
                            Rejected
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

      {settingsOpen && (
        <WorkshopSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          workshop={workshop}
        />
      )}

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
              <Label htmlFor="reject-note">Note (optional)</Label>
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
