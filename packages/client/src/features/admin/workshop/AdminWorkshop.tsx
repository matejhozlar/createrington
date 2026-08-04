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
import {
  LOADER_NAMES,
  formatDate,
  loaderName,
} from "@/features/workshop/format";

const WORKSHOP_STATUS_STYLES: Record<string, string> = {
  draft: "border-zinc-500/50 bg-zinc-500/10 text-zinc-400",
  open: "border-green-500/50 bg-green-500/10 text-green-400",
  closed: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  archived: "border-red-500/50 bg-red-500/10 text-red-400",
};

export function AdminWorkshop() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const workshopsQuery = trpc.admin.workshops.list.useQuery();
  const flagsQuery = trpc.admin.features.list.useQuery();
  const workshopFlag = flagsQuery.data?.find((f) => f.name === "workshop");

  const setFlagMutation = trpc.admin.features.set.useMutation({
    onSuccess: (flag) => {
      toast.success(`Workshop ${flag.enabled ? "enabled" : "disabled"}`);
      utils.admin.features.list.invalidate();
      utils.user.workshops.enabled.invalidate();
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
  const [forumChannelId, setForumChannelId] = useState("");
  const [basePackId, setBasePackId] = useState("");
  const [modpackSel, setModpackSel] = useState("new");
  const [modpackName, setModpackName] = useState("");

  const modpacksQuery = trpc.admin.modpacks.list.useQuery();

  const createModpackMutation = trpc.admin.modpacks.create.useMutation({
    onSuccess: () => utils.admin.modpacks.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.admin.workshops.create.useMutation({
    onSuccess: (workshop) => {
      toast.success(`Workshop "${workshop.name}" created as draft`);
      utils.admin.workshops.list.invalidate();
      setCreateOpen(false);
      navigate(`/admin/tools/workshop/${workshop.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = async () => {
    let modpackId: number;
    if (modpackSel === "new") {
      try {
        const modpack = await createModpackMutation.mutateAsync({
          name: modpackName.trim(),
        });
        modpackId = modpack.id;
      } catch {
        return;
      }
    } else {
      modpackId = Number(modpackSel);
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      gameVersion: gameVersion.trim(),
      modLoaderType: Number(loaderType),
      modpackId,
      maxModsPerUser: Number(maxMods) || 5,
      maxUpvotesPerUser: Number(maxUpvotes) || 5,
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
            htmlFor="workshop-enabled"
            className="text-sm text-muted-foreground"
          >
            Feature enabled
          </Label>
          <Switch
            id="workshop-enabled"
            checked={workshopFlag?.enabled ?? false}
            disabled={flagsQuery.isLoading || setFlagMutation.isPending}
            onCheckedChange={(checked) =>
              setFlagMutation.mutate({
                name: "workshop",
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
            <CardTitle>Workshops</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New workshop
            </Button>
          </CardHeader>
          <CardContent>
            {workshopsQuery.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (workshopsQuery.data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No workshops yet, create the first one.
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
                  {workshopsQuery.data?.map((workshop) => (
                    <TableRow
                      key={workshop.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(`/admin/tools/workshop/${workshop.id}`)
                      }
                    >
                      <TableCell>
                        <div className="font-medium">{workshop.name}</div>
                        <div className="text-xs text-muted-foreground">
                          /{workshop.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={WORKSHOP_STATUS_STYLES[workshop.status]}
                        >
                          {workshop.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {workshop.gameVersion} ·{" "}
                        {loaderName(workshop.modLoaderType)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {workshop.maxModsPerUser} mods
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(workshop.createdAt)}
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
            <DialogTitle>New workshop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workshop-name">Name</Label>
              <Input
                id="workshop-name"
                placeholder="Createrington Season 3 Modpack"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workshop-desc">Description</Label>
              <Input
                id="workshop-desc"
                placeholder="What is this workshop about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Modpack this workshop feeds</Label>
              <Select value={modpackSel} onValueChange={setModpackSel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create a new modpack</SelectItem>
                  {modpacksQuery.data?.map((modpack) => (
                    <SelectItem key={modpack.id} value={String(modpack.id)}>
                      {modpack.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {modpackSel === "new" && (
              <div className="space-y-2">
                <Label htmlFor="workshop-modpack-name">Modpack name</Label>
                <Input
                  id="workshop-modpack-name"
                  placeholder="Createrington Season 3"
                  value={modpackName}
                  onChange={(e) => setModpackName(e.target.value)}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workshop-version">Game version</Label>
                <Input
                  id="workshop-version"
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
                <Label htmlFor="workshop-max">Suggestions per player</Label>
                <Input
                  id="workshop-max"
                  type="number"
                  min={1}
                  max={25}
                  value={maxMods}
                  onChange={(e) => setMaxMods(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workshop-max-upvotes">Upvotes per player</Label>
                <Input
                  id="workshop-max-upvotes"
                  type="number"
                  min={1}
                  max={100}
                  value={maxUpvotes}
                  onChange={(e) => setMaxUpvotes(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workshop-basepack">
                Base modpack ID (optional)
              </Label>
              <Input
                id="workshop-basepack"
                type="number"
                placeholder="Leave empty for a fresh workshop"
                value={basePackId}
                onChange={(e) => setBasePackId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workshop-forum">
                Discord forum channel ID (optional)
              </Label>
              <Input
                id="workshop-forum"
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
                createMutation.isPending ||
                createModpackMutation.isPending ||
                !name.trim() ||
                !gameVersion.trim() ||
                (modpackSel === "new" && !modpackName.trim())
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
