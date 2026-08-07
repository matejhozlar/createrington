import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { workshopFormError } from "../../validation";

interface WorkshopSettings {
  id: number;
  name: string;
  description: string | null;
  gameVersion: string;
  modLoaderType: number;
  maxModsPerUser: number;
  maxUpvotesPerUser: number;
  discordForumChannelId: string | null;
  baseModpackProjectId: number | null;
}

export function WorkshopSettingsDialog({
  open,
  onOpenChange,
  workshop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop: WorkshopSettings;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [name, setName] = useState(workshop.name);
  const [description, setDescription] = useState(workshop.description ?? "");
  const [gameVersion, setGameVersion] = useState(workshop.gameVersion);
  const [loaderType, setLoaderType] = useState(String(workshop.modLoaderType));
  const [maxMods, setMaxMods] = useState(String(workshop.maxModsPerUser));
  const [maxUpvotes, setMaxUpvotes] = useState(
    String(workshop.maxUpvotesPerUser),
  );
  const [forumChannelId, setForumChannelId] = useState(
    workshop.discordForumChannelId ?? "",
  );
  const [basePackId, setBasePackId] = useState(
    workshop.baseModpackProjectId ? String(workshop.baseModpackProjectId) : "",
  );

  const updateMutation = trpc.admin.workshops.update.useMutation({
    onSuccess: () => {
      toast.success("Workshop settings saved");
      utils.admin.workshops.list.invalidate();
      utils.user.workshops.list.invalidate();
      utils.user.workshops.get.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
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
    updateMutation.mutate({
      workshopId: workshop.id,
      patch: {
        name: name.trim(),
        description: description.trim() || null,
        gameVersion: gameVersion.trim(),
        modLoaderType: Number(loaderType),
        maxModsPerUser: Number(maxMods),
        maxUpvotesPerUser: Number(maxUpvotes),
        discordForumChannelId: forumChannelId.trim() || null,
        baseModpackProjectId: basePackId.trim() ? Number(basePackId) : null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Workshop Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-desc">Description</Label>
            <Input
              id="settings-desc"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="settings-version">Game Version</Label>
              <Input
                id="settings-version"
                maxLength={20}
                value={gameVersion}
                onChange={(e) => setGameVersion(e.target.value)}
              />
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
              <Label htmlFor="settings-max">Suggestions per Player</Label>
              <Input
                id="settings-max"
                type="number"
                min={1}
                max={25}
                value={maxMods}
                onChange={(e) => setMaxMods(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-max-upvotes">Upvotes per Player</Label>
              <Input
                id="settings-max-upvotes"
                type="number"
                min={1}
                max={100}
                value={maxUpvotes}
                onChange={(e) => setMaxUpvotes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-basepack">
              Base Modpack ID (Optional)
            </Label>
            <Input
              id="settings-basepack"
              type="number"
              value={basePackId}
              onChange={(e) => setBasePackId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-forum">
              Discord Forum Channel ID (Optional)
            </Label>
            <Input
              id="settings-forum"
              placeholder="Forum for per-suggestion discussion threads"
              value={forumChannelId}
              onChange={(e) => setForumChannelId(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Changing the game version or loader does not revalidate mods that
            are already in the workshop.
          </p>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={
              updateMutation.isPending || !name.trim() || !gameVersion.trim()
            }
          >
            {updateMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
