import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { modpackFormError } from "@/features/admin/workshop/validation";
import { useMutation } from "@tanstack/react-query";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { Field, FieldLabel } from "@/components/ui/field";

export function CreateModpackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const toast = useToastActions();

  const [draft, update] = useDialogDraft<{
    name: string;
    description: string;
    publishedPackId: string;
  }>(open, () => ({ name: "", description: "", publishedPackId: "" }));
  const { name, description, publishedPackId } = draft;

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
      <Field>
        <FieldLabel htmlFor="modpack-name">Name</FieldLabel>
        <Input
          id="modpack-name"
          placeholder="Createrington Season 3"
          maxLength={120}
          value={name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="modpack-desc">Description</FieldLabel>
        <Input
          id="modpack-desc"
          placeholder="What is this pack?"
          maxLength={2000}
          value={description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="modpack-published">
          Published Modpack Project ID (Optional)
        </FieldLabel>
        <Input
          id="modpack-published"
          type="number"
          placeholder="CurseForge project the pack is published under"
          value={publishedPackId}
          onChange={(e) => update({ publishedPackId: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Leave empty until the pack is on CurseForge. Once set, live state is
          derived from the published manifest.
        </p>
      </Field>
    </FormDialog>
  );
}
