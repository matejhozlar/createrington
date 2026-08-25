import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { modpackFormError } from "../validation";

interface ModpackSettings {
  id: number;
  name: string;
  description: string | null;
  curseforgeProjectId: number | null;
  shipsServerPack: boolean;
  titleImageUrl: string | null;
}

export function ModpackSettingsDialog({
  open,
  onOpenChange,
  modpack,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modpack: ModpackSettings;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [name, setName] = useState(modpack.name);
  const [description, setDescription] = useState(modpack.description ?? "");
  const [publishedPackId, setPublishedPackId] = useState(
    modpack.curseforgeProjectId ? String(modpack.curseforgeProjectId) : "",
  );
  const [shipsServerPack, setShipsServerPack] = useState(
    modpack.shipsServerPack,
  );
  const [titleImageUrl, setTitleImageUrl] = useState(
    modpack.titleImageUrl ?? "",
  );

  const updateMutation = trpc.admin.modpacks.update.useMutation({
    onSuccess: () => {
      toast.success("Modpack settings saved");
      utils.admin.modpacks.list.invalidate();
      utils.admin.workshops.listPackMods.invalidate();
      utils.admin.workshops.getAttention.invalidate();
      utils.user.workshops.list.invalidate();
      utils.user.workshops.get.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    const validationError = modpackFormError(publishedPackId, titleImageUrl);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    updateMutation.mutate({
      modpackId: modpack.id,
      patch: {
        name: name.trim(),
        description: description.trim() || null,
        curseforgeProjectId: publishedPackId.trim()
          ? Number(publishedPackId)
          : null,
        shipsServerPack,
        titleImageUrl: titleImageUrl.trim() || null,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Modpack Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modpack-settings-name">Name</Label>
            <Input
              id="modpack-settings-name"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modpack-settings-desc">Description</Label>
            <Input
              id="modpack-settings-desc"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modpack-settings-published">
              Published Modpack Project ID (Optional)
            </Label>
            <Input
              id="modpack-settings-published"
              type="number"
              placeholder="CurseForge project the pack is published under"
              value={publishedPackId}
              onChange={(e) => setPublishedPackId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Set this once the pack is on CurseForge. It is what "Check
              Published Pack" reads, and it applies to every workshop feeding
              this modpack.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="modpack-settings-title-image">
              Title Image URL (Optional)
            </Label>
            <Input
              id="modpack-settings-title-image"
              inputMode="url"
              maxLength={2048}
              placeholder="https://assets.createrington.com/titles/..."
              value={titleImageUrl}
              onChange={(e) => setTitleImageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Full-width banner at the top of this pack's changelog posts in
              Discord. Leave empty to use a text heading instead.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:border-[var(--border-strong)]">
            <Switch
              checked={shipsServerPack}
              onCheckedChange={setShipsServerPack}
            />
            <div className="space-y-0.5">
              <div className="text-[13px] font-medium text-foreground">
                Ships a server pack
              </div>
              <div className="text-xs text-muted-foreground">
                Turns on by itself once a release is read together with its
                server pack. While on, "Check Published Pack" refuses a read
                that finds no server pack instead of marking every server-side
                mod as dropped. Turn it off only if the pack stopped shipping
                one for good.
              </div>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
            loading={updateMutation.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
