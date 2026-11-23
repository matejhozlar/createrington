import { Save } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

export function EditPackDialog({
  open,
  onClose,
  packId,
  initialName,
  initialDescription,
}: {
  open: boolean;
  onClose: () => void;
  packId: number;
  initialName: string;
  initialDescription: string;
}) {
  const [{ name, description }, update] = useDialogDraft(open, () => ({
    name: initialName,
    description: initialDescription,
  }));

  const updateMutation = useMutation(
    trpc.admin.structurePacks.update.mutationOptions(
      useMutationToast({
        success: "Pack updated",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.get.queryFilter({ id: packId }),
          );
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.list.pathFilter(),
          );
          onClose();
        },
      }),
    ),
  );

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Edit Pack"
      confirmLabel={
        <>
          <Save className="mr-1 size-3" />
          Save
        </>
      }
      onConfirm={() =>
        updateMutation.mutate({
          id: packId,
          name,
          description: description || undefined,
        })
      }
      disabled={!name.trim()}
      loading={updateMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
      <Field>
        <FieldLabel htmlFor="edit-pack-name">Name</FieldLabel>
        <Input
          id="edit-pack-name"
          value={name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="edit-pack-description">Description</FieldLabel>
        <Input
          id="edit-pack-description"
          value={description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
    </FormDialog>
  );
}
