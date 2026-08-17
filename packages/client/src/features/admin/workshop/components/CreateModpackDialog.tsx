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
import { modpackFormError } from "../validation";

export function CreateModpackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publishedPackId, setPublishedPackId] = useState("");

  const createMutation = trpc.admin.modpacks.create.useMutation({
    onSuccess: (modpack) => {
      toast.success(`Modpack "${modpack.name}" created`);
      utils.admin.modpacks.list.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = () => {
    const validationError = modpackFormError(publishedPackId);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      curseforgeProjectId: publishedPackId.trim()
        ? Number(publishedPackId)
        : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>New Modpack</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modpack-name">Name</Label>
            <Input
              id="modpack-name"
              placeholder="Createrington Season 3"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modpack-desc">Description</Label>
            <Input
              id="modpack-desc"
              placeholder="What is this pack?"
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modpack-published">
              Published Modpack Project ID (Optional)
            </Label>
            <Input
              id="modpack-published"
              type="number"
              placeholder="CurseForge project the pack is published under"
              value={publishedPackId}
              onChange={(e) => setPublishedPackId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty until the pack is on CurseForge. Once set, live state
              is derived from the published manifest.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!name.trim()}
            loading={createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
