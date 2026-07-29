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
  Shield,
  X,
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
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ModDetailDialog } from "@/features/voting/vote-detail/components/ModDetailDialog";
import { MOD_STATUS_STYLES, formatDate } from "@/features/voting/format";
import { AddModsDialog } from "./components/AddModsDialog";
import { VoteSettingsDialog } from "./components/VoteSettingsDialog";

type StatusFilter = "all" | "pending" | "approved" | "declined" | "rejected";

const VOTE_STATUSES = ["draft", "open", "closed", "archived"] as const;

export function AdminVoteDetail() {
  const { id } = useParams<{ id: string }>();
  const voteId = Number(id);
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const votesQuery = trpc.admin.votes.list.useQuery();
  const vote = votesQuery.data?.find((v) => v.id === voteId);

  const modsQuery = trpc.admin.votes.listMods.useQuery(
    { voteId },
    { enabled: Number.isFinite(voteId) },
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailModId, setDetailModId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{
    voteModId: number;
    name: string;
  } | null>(null);
  const displayRejectTarget = useStickyValue(rejectTarget);
  const [rejectReason, setRejectReason] = useState("");

  const invalidate = () => {
    utils.admin.votes.listMods.invalidate({ voteId });
    utils.admin.votes.getMod.invalidate();
    utils.admin.votes.searchProjects.invalidate({ voteId });
    utils.admin.votes.listBans.invalidate();
    utils.user.votes.get.invalidate();
  };

  const reviewMutation = trpc.admin.votes.reviewMod.useMutation({
    onSuccess: (_mod, variables) => {
      const verb =
        variables.action === "approve"
          ? "approved"
          : variables.action === "decline"
            ? "declined"
            : "rejected and banned";
      toast.success(`Mod ${verb}`);
      invalidate();
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateVoteMutation = trpc.admin.votes.update.useMutation({
    onSuccess: () => {
      toast.success("Vote updated");
      utils.admin.votes.list.invalidate();
      utils.user.votes.list.invalidate();
      utils.user.votes.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const mods = useMemo(() => modsQuery.data ?? [], [modsQuery.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: mods.length,
      pending: 0,
      approved: 0,
      declined: 0,
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

  if (votesQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!vote) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Vote not found
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop", href: "/admin/tools/voting" },
          { label: vote.name },
        ]}
      >
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={vote.status}
            onValueChange={(status) =>
              updateVoteMutation.mutate({
                voteId,
                patch: { status: status as (typeof VOTE_STATUSES)[number] },
              })
            }
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOTE_STATUSES.map((s) => (
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
          {(
            ["all", "pending", "approved", "declined", "rejected"] as const
          ).map((status) => (
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
          ))}
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
                      reviewMutation.variables?.voteModId === mod.id;
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
                          <div className="flex items-center gap-1.5 text-sm">
                            {mod.source === "admin" && (
                              <Shield className="size-3 text-primary" />
                            )}
                            {mod.submitterName ?? mod.submittedBy}
                          </div>
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
                              {mod.status !== "approved" &&
                                mod.status !== "rejected" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      reviewMutation.mutate({
                                        voteModId: mod.id,
                                        action: "approve",
                                      })
                                    }
                                  >
                                    <Check className="size-4 text-green-500" />
                                    Approve
                                  </DropdownMenuItem>
                                )}
                              {(mod.status === "pending" ||
                                mod.status === "approved") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      voteModId: mod.id,
                                      action: "decline",
                                    })
                                  }
                                >
                                  <X className="size-4 text-yellow-500" />
                                  Decline
                                </DropdownMenuItem>
                              )}
                              {mod.status !== "rejected" && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setRejectTarget({
                                      voteModId: mod.id,
                                      name: mod.project.name,
                                    })
                                  }
                                >
                                  <Ban className="size-4" />
                                  Reject &amp; ban
                                </DropdownMenuItem>
                              )}
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
      </div>

      <ModDetailDialog
        voteModId={detailModId}
        onOpenChange={(open) => !open && setDetailModId(null)}
        admin
      />

      <AddModsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        voteId={voteId}
        onAdded={invalidate}
      />

      {settingsOpen && (
        <VoteSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          vote={vote}
        />
      )}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {displayRejectTarget?.name}?</DialogTitle>
            <DialogDescription>
              Rejecting bans this project from every current and future vote.
              Any other pending or approved entries of it are rejected too.
              Prefer Decline for a soft no.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Input
              id="reject-reason"
              placeholder="Why is this mod banned? Shown to players."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() =>
                displayRejectTarget &&
                reviewMutation.mutate({
                  voteModId: displayRejectTarget.voteModId,
                  action: "reject",
                  reason: rejectReason.trim(),
                })
              }
              disabled={
                reviewMutation.isPending || rejectReason.trim().length < 5
              }
            >
              {reviewMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Reject &amp; ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
