import { useState } from "react";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { modpackFormError } from "../validation";
import { useMutation } from "@tanstack/react-query";

export function CreateModpackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToastActions();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [publishedPackId, setPublishedPackId] = useState("");

  const createMutation = useMutation(
    trpc.admin.modpacks.create.mutationOptions(
      useMutationToast({
        success: (modpack) => `Modpack "${modpack.name}" created`,
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.modpacks.list.pathFilter(),
          );
          onOpenChange(false);
        },
      }),
    ),
  );

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
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="New Modpack"
      onConfirm={handleCreate}
      confirmLabel="Create"
      disabled={!name.trim()}
      loading={createMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
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
            Leave empty until the pack is on CurseForge. Once set, live state is
            derived from the published manifest.
          </p>
        </div>
      </div>
    </FormDialog>
  );
}
