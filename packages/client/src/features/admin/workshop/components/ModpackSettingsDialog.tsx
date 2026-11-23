import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { modpackFormError } from "@/features/admin/workshop/validation";
import { useMutation } from "@tanstack/react-query";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { Field, FieldLabel } from "@/components/ui/field";

interface ModpackSettings {
  id: number;
  name: string;
  description: string | null;
  curseforgeProjectId: number | null;
  shipsServerPack: boolean;
  titleImageUrl: string | null;
  iconUrl: string | null;
}

export function ModpackSettingsDialog({
  modpack,
  onOpenChange,
}: {
  modpack: ModpackSettings | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = modpack !== null;
  const toast = useToastActions();

  const [draft, update] = useDialogDraft<{
    name: string;
    description: string;
    publishedPackId: string;
    shipsServerPack: boolean;
    titleImageUrl: string;
    iconUrl: string;
  }>(open, () => ({
    name: modpack?.name ?? "",
    description: modpack?.description ?? "",
    publishedPackId: modpack?.curseforgeProjectId
      ? String(modpack.curseforgeProjectId)
      : "",
    shipsServerPack: modpack?.shipsServerPack ?? false,
    titleImageUrl: modpack?.titleImageUrl ?? "",
    iconUrl: modpack?.iconUrl ?? "",
  }));
  const {
    name,
    description,
    publishedPackId,
    shipsServerPack,
    titleImageUrl,
    iconUrl,
  } = draft;

  const updateMutation = useMutation(
    trpc.admin.modpacks.update.mutationOptions(
      useMutationToast({
        success: "Modpack settings saved",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.modpacks.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.admin.workshops.listPackMods.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.admin.workshops.attention.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.get.pathFilter(),
          );
          onOpenChange(false);
        },
      }),
    ),
  );

  const handleSave = () => {
    if (!modpack) return;
    const validationError = modpackFormError(
      publishedPackId,
      titleImageUrl,
      iconUrl,
    );
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
        iconUrl: iconUrl.trim() || null,
      },
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Modpack Settings"
      onConfirm={handleSave}
      confirmLabel="Save"
      disabled={!name.trim()}
      loading={updateMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
      <Field>
        <FieldLabel htmlFor="modpack-settings-name">Name</FieldLabel>
        <Input
          id="modpack-settings-name"
          maxLength={120}
          value={name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="modpack-settings-desc">Description</FieldLabel>
        <Input
          id="modpack-settings-desc"
          maxLength={2000}
          value={description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="modpack-settings-published">
          Published Modpack Project ID (Optional)
        </FieldLabel>
        <Input
          id="modpack-settings-published"
          type="number"
          placeholder="CurseForge project the pack is published under"
          value={publishedPackId}
          onChange={(e) => update({ publishedPackId: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Set this once the pack is on CurseForge. It is what "Check Published
          Pack" reads, and it applies to every workshop feeding this modpack.
        </p>
      </Field>
      <Field>
        <FieldLabel htmlFor="modpack-settings-title-image">
          Title Image URL (Optional)
        </FieldLabel>
        <Input
          id="modpack-settings-title-image"
          inputMode="url"
          maxLength={2048}
          placeholder="https://assets.createrington.com/titles/..."
          value={titleImageUrl}
          onChange={(e) => update({ titleImageUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Full-width banner at the top of this pack's changelog posts in
          Discord. Leave empty to use a text heading instead.
        </p>
      </Field>
      <Field>
        <FieldLabel htmlFor="modpack-settings-icon">
          Icon URL (Optional)
        </FieldLabel>
        <Input
          id="modpack-settings-icon"
          inputMode="url"
          maxLength={2048}
          placeholder="https://assets.createrington.com/icons/..."
          value={iconUrl}
          onChange={(e) => update({ iconUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Square icon the launcher shows for this pack when its releases do not
          come from CurseForge. A published pack uses its CurseForge icon
          instead.
        </p>
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 hover:border-[var(--border-strong)]">
        <Switch
          checked={shipsServerPack}
          onCheckedChange={(value: boolean) =>
            update({ shipsServerPack: value })
          }
        />
        <div className="space-y-0.5">
          <div className="text-[13px] font-medium text-foreground">
            Ships a server pack
          </div>
          <div className="text-xs text-muted-foreground">
            Turns on by itself once a release is read together with its server
            pack. While on, "Check Published Pack" refuses a read that finds no
            server pack instead of marking every server-side mod as dropped.
            Turn it off only if the pack stopped shipping one for good.
          </div>
        </div>
      </label>
    </FormDialog>
  );
}
