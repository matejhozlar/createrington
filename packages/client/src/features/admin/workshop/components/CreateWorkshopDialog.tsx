import { useNavigate } from "react-router";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOADER_NAMES } from "@/features/workshop/format";
import { workshopFormError } from "@/features/admin/workshop/validation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDialogDraft } from "@/hooks/use-dialog-draft";
import { Field, FieldLabel } from "@/components/ui/field";

export function CreateWorkshopDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const toast = useToastActions();

  const [draft, update] = useDialogDraft<{
    name: string;
    description: string;
    gameVersion: string;
    loaderType: string;
    maxMods: string;
    maxUpvotes: string;
    forumChannelId: string;
    basePackId: string;
    modpackSel: string;
    modpackName: string;
  }>(open, () => ({
    name: "",
    description: "",
    gameVersion: "",
    loaderType: "6",
    maxMods: "5",
    maxUpvotes: "5",
    forumChannelId: "",
    basePackId: "",
    modpackSel: "new",
    modpackName: "",
  }));
  const {
    name,
    description,
    gameVersion,
    loaderType,
    maxMods,
    maxUpvotes,
    forumChannelId,
    basePackId,
    modpackSel,
    modpackName,
  } = draft;

  const modpacksQuery = useQuery(
    trpc.admin.modpacks.list.queryOptions(undefined, {
      enabled: open,
    }),
  );
  const versionsQuery = useQuery(
    trpc.admin.workshops.listGameVersions.queryOptions(undefined, {
      enabled: open,
    }),
  );

  const createMutation = useMutation(
    trpc.admin.workshops.create.mutationOptions(
      useMutationToast({
        success: (workshop) => `Workshop "${workshop.name}" created as draft`,
        onSuccess: (workshop) => {
          void queryClient.invalidateQueries(
            trpc.admin.workshops.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.admin.modpacks.list.pathFilter(),
          );
          onOpenChange(false);
          void navigate(`/admin/tools/workshop/${workshop.slug}`);
        },
      }),
    ),
  );

  const handleCreate = () => {
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
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      gameVersion: gameVersion.trim(),
      modLoaderType: Number(loaderType),
      ...(modpackSel === "new"
        ? { newModpackName: modpackName.trim() }
        : { modpackId: Number(modpackSel) }),
      maxModsPerUser: Number(maxMods),
      maxUpvotesPerUser: Number(maxUpvotes),
      discordForumChannelId: forumChannelId.trim() || undefined,
      baseModpackProjectId: basePackId.trim() ? Number(basePackId) : undefined,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="New Workshop"
      onConfirm={handleCreate}
      confirmLabel="Create Draft"
      disabled={
        !name.trim() ||
        !gameVersion.trim() ||
        (modpackSel === "new" && !modpackName.trim())
      }
      loading={createMutation.isPending}
      contentClassName="sm:max-w-lg"
    >
      <Field>
        <FieldLabel htmlFor="workshop-name">Name</FieldLabel>
        <Input
          id="workshop-name"
          placeholder="Createrington Season 3 Modpack"
          maxLength={120}
          value={name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="workshop-desc">Description</FieldLabel>
        <Input
          id="workshop-desc"
          placeholder="What is this workshop about?"
          maxLength={2000}
          value={description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="workshop-modpack">Modpack</FieldLabel>
        <Select
          value={modpackSel}
          onValueChange={(value: string) => update({ modpackSel: value })}
        >
          <SelectTrigger id="workshop-modpack">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New Modpack</SelectItem>
            {modpacksQuery.data?.map((modpack) => (
              <SelectItem key={modpack.id} value={String(modpack.id)}>
                {modpack.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {modpackSel === "new" && (
        <Field>
          <FieldLabel htmlFor="workshop-modpack-name">Modpack Name</FieldLabel>
          <Input
            id="workshop-modpack-name"
            placeholder="Createrington Season 3"
            maxLength={120}
            value={modpackName}
            onChange={(e) => update({ modpackName: e.target.value })}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="workshop-version">Game Version</FieldLabel>
          {versionsQuery.error || versionsQuery.data?.length === 0 ? (
            <Input
              id="workshop-version"
              placeholder="1.21.1"
              maxLength={20}
              value={gameVersion}
              onChange={(e) => update({ gameVersion: e.target.value })}
            />
          ) : (
            <Select
              value={gameVersion}
              onValueChange={(value: string) => update({ gameVersion: value })}
              disabled={versionsQuery.isLoading}
            >
              <SelectTrigger id="workshop-version">
                <SelectValue
                  placeholder={
                    versionsQuery.isLoading ? "Loading..." : "Pick a version"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {versionsQuery.data?.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="workshop-loader">Mod Loader</FieldLabel>
          <Select
            value={loaderType}
            onValueChange={(value: string) => update({ loaderType: value })}
          >
            <SelectTrigger id="workshop-loader">
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
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="workshop-max">Suggestions per Player</FieldLabel>
          <Input
            id="workshop-max"
            type="number"
            min={1}
            max={25}
            value={maxMods}
            onChange={(e) => update({ maxMods: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="workshop-max-upvotes">
            Upvotes per Player
          </FieldLabel>
          <Input
            id="workshop-max-upvotes"
            type="number"
            min={1}
            max={100}
            value={maxUpvotes}
            onChange={(e) => update({ maxUpvotes: e.target.value })}
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="workshop-basepack">
          Base Modpack ID (Optional)
        </FieldLabel>
        <Input
          id="workshop-basepack"
          type="number"
          placeholder="Leave empty for a fresh workshop"
          value={basePackId}
          onChange={(e) => update({ basePackId: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="workshop-forum">
          Discord Forum Channel ID (Optional)
        </FieldLabel>
        <Input
          id="workshop-forum"
          placeholder="Forum for per-suggestion discussion threads"
          value={forumChannelId}
          onChange={(e) => update({ forumChannelId: e.target.value })}
        />
      </Field>
    </FormDialog>
  );
}
