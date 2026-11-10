import { useState } from "react";
import { Save } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";

/**
 * Edit form for pack name and description.
 *
 * Mount this conditionally (`{editing && <EditPackDialog .../>}`) so the form
 * state resets automatically every time the dialog is opened. Initial values
 * are captured via `useState` on mount.
 */
export function EditPackDialog({
  onClose,
  packId,
  initialName,
  initialDescription,
}: {
  onClose: () => void;
  packId: number;
  initialName: string;
  initialDescription: string;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

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
      open
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
      disabled={!name.trim() || updateMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </FormDialog>
  );
}
