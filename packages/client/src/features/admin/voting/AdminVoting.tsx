import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
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
  const flagsQuery = trpc.admin.features.list.useQuery();
  const votingFlag = flagsQuery.data?.find((f) => f.name === "voting");

  const setFlagMutation = trpc.admin.features.set.useMutation({
    onSuccess: (flag) => {
      toast.success(`Workshop ${flag.enabled ? "enabled" : "disabled"}`);
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
  const [maxUpvotes, setMaxUpvotes] = useState("5");
  const [closesAt, setClosesAt] = useState("");
  const [forumChannelId, setForumChannelId] = useState("");
  const [basePackId, setBasePackId] = useState("");

  const createMutation = trpc.admin.votes.create.useMutation({
    onSuccess: (vote) => {
      toast.success(`Workshop "${vote.name}" created as draft`);
      utils.admin.votes.list.invalidate();
      setCreateOpen(false);
      navigate(`/admin/tools/voting/${vote.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      gameVersion: gameVersion.trim(),
      modLoaderType: Number(loaderType),
      maxModsPerUser: Number(maxMods) || 5,
      maxUpvotesPerUser: Number(maxUpvotes) || 5,
      closesAt: closesAt ? new Date(closesAt) : undefined,
      discordForumChannelId: forumChannelId.trim() || undefined,
      baseModpackProjectId: basePackId.trim() ? Number(basePackId) : undefined,
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop" },
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
                description: "Workshop tab",
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
                        {vote.maxModsPerUser} mods
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
                <Label htmlFor="vote-max">Suggestions per player</Label>
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
                <Label htmlFor="vote-max-upvotes">Upvotes per player</Label>
                <Input
                  id="vote-max-upvotes"
                  type="number"
                  min={1}
                  max={100}
                  value={maxUpvotes}
                  onChange={(e) => setMaxUpvotes(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vote-closes">Closes at (optional)</Label>
                <Input
                  id="vote-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vote-basepack">
                  Base modpack ID (optional)
                </Label>
                <Input
                  id="vote-basepack"
                  type="number"
                  placeholder="Leave empty for a fresh vote"
                  value={basePackId}
                  onChange={(e) => setBasePackId(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vote-forum">
                Discord forum channel ID (optional)
              </Label>
              <Input
                id="vote-forum"
                placeholder="Forum for per-suggestion discussion threads"
                value={forumChannelId}
                onChange={(e) => setForumChannelId(e.target.value)}
              />
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
    </div>
  );
}
