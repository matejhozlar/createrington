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
import { modpackFormError } from "../validation";

interface ModpackSettings {
  id: number;
  name: string;
  description: string | null;
  curseforgeProjectId: number | null;
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
    const validationError = modpackFormError(publishedPackId);
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
        </div>
        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !name.trim()}
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
