import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { FormDialog } from "@/components/form-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { trpc, queryClient } from "@/lib/trpc";

const EMPTY_DRAFT = { name: "", description: "" };

export function CreatePackDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [{ name, description }, update] = useDialogDraft(open, EMPTY_DRAFT);

  const createMutation = useMutation(
    trpc.admin.structurePacks.create.mutationOptions(
      useMutationToast({
        success: "Structure pack created",
        onSuccess: (pack) => {
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.list.pathFilter(),
          );
          onClose();
          void navigate(`/admin/tools/structure-packs/${pack.id}`);
        },
      }),
    ),
  );

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Create Structure Pack"
      confirmLabel="Create"
      onConfirm={() =>
        createMutation.mutate({
          name,
          description: description || undefined,
        })
      }
      disabled={!name.trim()}
      loading={createMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
      <Field>
        <FieldLabel htmlFor="structure-pack-name">Name</FieldLabel>
        <Input
          id="structure-pack-name"
          value={name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Medieval Structures"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="structure-pack-description">
          Description (optional)
        </FieldLabel>
        <Input
          id="structure-pack-description"
          value={description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="A collection of medieval-themed structure mods"
        />
      </Field>
    </FormDialog>
  );
}
