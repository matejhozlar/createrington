import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { LOADER_NAMES } from "@/features/workshop/format";
import { workshopFormError } from "../validation";

export function CreateWorkshopDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

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

  const modpacksQuery = trpc.admin.modpacks.list.useQuery(undefined, {
    enabled: open,
  });
  const versionsQuery = trpc.admin.workshops.listGameVersions.useQuery(
    undefined,
    { enabled: open },
  );

  const createMutation = trpc.admin.workshops.create.useMutation({
    onSuccess: (workshop) => {
      toast.success(`Workshop "${workshop.name}" created as draft`);
      utils.admin.workshops.list.invalidate();
      utils.admin.modpacks.list.invalidate();
      onOpenChange(false);
      navigate(`/admin/tools/workshop/${workshop.slug}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    const validationError = workshopFormError({
      maxMods,
      maxUpvotes,
      basePackId,
      forumChannelId,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      gameVersion: gameVersion.trim(),
      modLoaderType: Number(loaderType),
      ...(modpackSel === "new"
        ? { newModpackName: modpackName.trim() }
        : { modpackId: Number(modpackSel) }),
      maxModsPerUser: Number(maxMods),
      maxUpvotesPerUser: Number(maxUpvotes),
      discordForumChannelId: forumChannelId.trim() || undefined,
      baseModpackProjectId: basePackId.trim() ? Number(basePackId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New Workshop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workshop-name">Name</Label>
            <Input
              id="workshop-name"
              placeholder="Createrington Season 3 Modpack"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workshop-desc">Description</Label>
            <Input
              id="workshop-desc"
              placeholder="What is this workshop about?"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Modpack</Label>
            <Select value={modpackSel} onValueChange={setModpackSel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New Modpack</SelectItem>
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
              <Label htmlFor="workshop-modpack-name">Modpack Name</Label>
              <Input
                id="workshop-modpack-name"
                placeholder="Createrington Season 3"
                maxLength={120}
                value={modpackName}
                onChange={(e) => setModpackName(e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workshop-version">Game Version</Label>
              {versionsQuery.error || versionsQuery.data?.length === 0 ? (
                <Input
                  id="workshop-version"
                  placeholder="1.21.1"
                  maxLength={20}
                  value={gameVersion}
                  onChange={(e) => setGameVersion(e.target.value)}
                />
              ) : (
                <Select
                  value={gameVersion}
                  onValueChange={setGameVersion}
                  disabled={versionsQuery.isLoading}
                >
                  <SelectTrigger id="workshop-version">
                    <SelectValue
                      placeholder={
                        versionsQuery.isLoading
                          ? "Loading..."
                          : "Pick a version"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {versionsQuery.data?.map((version) => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mod Loader</Label>
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
              <Label htmlFor="workshop-max">Suggestions per Player</Label>
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
              <Label htmlFor="workshop-max-upvotes">Upvotes per Player</Label>
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
              Base Modpack ID (Optional)
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
              Discord Forum Channel ID (Optional)
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
              !name.trim() ||
              !gameVersion.trim() ||
              (modpackSel === "new" && !modpackName.trim())
            }
            loading={createMutation.isPending}
          >
            Create Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
