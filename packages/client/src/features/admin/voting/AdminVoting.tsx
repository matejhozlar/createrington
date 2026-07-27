import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, ChevronRight, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useStickyValue } from "@/hooks/use-sticky-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { LOADER_NAMES, formatDate, loaderName } from "@/features/voting/format";

const VOTE_STATUS_STYLES: Record<string, string> = {
  draft: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400",
  open: "border-green-500/50 bg-green-500/10 text-green-400",
  closed: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  archived: "border-red-500/50 bg-red-500/10 text-red-400",
};

export function AdminVoting() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const votesQuery = trpc.admin.votes.list.useQuery();
  const bansQuery = trpc.admin.votes.listBans.useQuery();
  const flagsQuery = trpc.admin.features.list.useQuery();
  const votingFlag = flagsQuery.data?.find((f) => f.name === "voting");

  const setFlagMutation = trpc.admin.features.set.useMutation({
    onSuccess: (flag) => {
      toast.success(`Voting ${flag.enabled ? "enabled" : "disabled"}`);
      utils.admin.features.list.invalidate();
      utils.user.votes.enabled.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gameVersion, setGameVersion] = useState("");
  const [loaderType, setLoaderType] = useState("6");
  const [maxMods, setMaxMods] = useState("5");
  const [basePackId, setBasePackId] = useState("");

  const createMutation = trpc.admin.votes.create.useMutation({
    onSuccess: (vote) => {
      toast.success(`Vote "${vote.name}" created as draft`);
      utils.admin.votes.list.invalidate();
      setCreateOpen(false);
      navigate(`/admin/tools/voting/${vote.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const [banOpen, setBanOpen] = useState(false);
  const [banProjectId, setBanProjectId] = useState("");
  const [banReason, setBanReason] = useState("");

  const banMutation = trpc.admin.votes.banProject.useMutation({
    onSuccess: () => {
      toast.success("Project banned");
      utils.admin.votes.listBans.invalidate();
      setBanOpen(false);
      setBanProjectId("");
      setBanReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const [unbanTarget, setUnbanTarget] = useState<{
    projectId: number;
    name: string;
  } | null>(null);
  const displayUnbanTarget = useStickyValue(unbanTarget);

  const unbanMutation = trpc.admin.votes.unbanProject.useMutation({
    onSuccess: () => {
      toast.success("Ban lifted");
      utils.admin.votes.listBans.invalidate();
      setUnbanTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      gameVersion: gameVersion.trim(),
      modLoaderType: Number(loaderType),
      maxModsPerSubmission: Number(maxMods) || 5,
      baseModpackProjectId: basePackId.trim() ? Number(basePackId) : undefined,
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Voting" },
        ]}
      >
        <div className="ml-auto flex items-center gap-2">
          <Label
            htmlFor="voting-enabled"
            className="text-sm text-muted-foreground"
          >
            Feature enabled
          </Label>
          <Switch
            id="voting-enabled"
            checked={votingFlag?.enabled ?? false}
            disabled={flagsQuery.isLoading || setFlagMutation.isPending}
            onCheckedChange={(checked) =>
              setFlagMutation.mutate({
                name: "voting",
                enabled: checked,
                description: "Community voting tab",
              })
            }
          />
        </div>
      </AdminPageHeader>

      <div className="mx-auto w-full max-w-[1100px] flex flex-1 flex-col gap-6 px-4 pb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Votes</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New vote
            </Button>
          </CardHeader>
          <CardContent>
            {votesQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (votesQuery.data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No votes yet, create the first one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Cap</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {votesQuery.data?.map((vote) => (
                    <TableRow
                      key={vote.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/tools/voting/${vote.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{vote.name}</div>
                        <div className="text-xs text-muted-foreground">
                          /{vote.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={VOTE_STATUS_STYLES[vote.status]}
                        >
                          {vote.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {vote.gameVersion} · {loaderName(vote.modLoaderType)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {vote.maxModsPerSubmission} mods
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(vote.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Banned projects</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBanOpen(true)}
            >
              <Ban className="size-4" />
              Ban project
            </Button>
          </CardHeader>
          <CardContent>
            {bansQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (bansQuery.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No banned projects.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Banned</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bansQuery.data?.map(({ ban, project }) => (
                    <TableRow key={ban.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {project?.thumbnailUrl && (
                            <img
                              src={project.thumbnailUrl}
                              alt=""
                              className="size-7 rounded"
                            />
                          )}
                          <span className="font-medium">
                            {project?.name ?? `#${ban.curseforgeProjectId}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                        {ban.reason ?? "No reason given"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(ban.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setUnbanTarget({
                              projectId: ban.curseforgeProjectId,
                              name:
                                project?.name ?? `#${ban.curseforgeProjectId}`,
                            })
                          }
                        >
                          Unban
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New vote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vote-name">Name</Label>
              <Input
                id="vote-name"
                placeholder="Createrington Season 3 Modpack"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vote-desc">Description</Label>
              <Input
                id="vote-desc"
                placeholder="What is this vote about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vote-version">Game version</Label>
                <Input
                  id="vote-version"
                  placeholder="1.21.1"
                  value={gameVersion}
                  onChange={(e) => setGameVersion(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mod loader</Label>
                <Select value={loaderType} onValueChange={setLoaderType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOADER_NAMES).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vote-max">Mods per submission</Label>
                <Input
                  id="vote-max"
                  type="number"
                  min={1}
                  max={25}
                  value={maxMods}
                  onChange={(e) => setMaxMods(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote-basepack">
                  Base modpack ID (optional)
                </Label>
                <Input
                  id="vote-basepack"
                  type="number"
                  placeholder="1316177"
                  value={basePackId}
                  onChange={(e) => setBasePackId(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending || !name.trim() || !gameVersion.trim()
              }
            >
              {createMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban a CurseForge project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ban-project">CurseForge project ID</Label>
              <Input
                id="ban-project"
                type="number"
                placeholder="328085"
                value={banProjectId}
                onChange={(e) => setBanProjectId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ban-reason">Reason (optional)</Label>
              <Input
                id="ban-reason"
                placeholder="Why is this mod banned?"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Banning rejects every pending or approved instance of this project
              across all votes and blocks future submissions.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() =>
                banMutation.mutate({
                  projectId: Number(banProjectId),
                  reason: banReason.trim() || undefined,
                })
              }
              disabled={banMutation.isPending || !banProjectId.trim()}
            >
              {banMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Ban project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={unbanTarget !== null}
        onOpenChange={(open) => !open && setUnbanTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unban {displayUnbanTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Players will be able to submit this project again. Previously
              rejected entries stay rejected but become reviewable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                displayUnbanTarget &&
                unbanMutation.mutate({
                  projectId: displayUnbanTarget.projectId,
                })
              }
            >
              {unbanMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Unban"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
