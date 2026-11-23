import { useState } from "react";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { workshopFormError } from "@/features/admin/workshop/validation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Field, FieldLabel } from "@/components/ui/field";

interface WorkshopSettings {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  modpackId: number;
  maxModsPerUser: number;
  maxUpvotesPerUser: number;
  discordForumChannelId: string | null;
  baseModpackProjectId: number | null;
}

export function WorkshopSettingsDialog({
  open,
  onOpenChange,
  workshop,
  hasMods,
  onSlugChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop: WorkshopSettings | null;
  hasMods: boolean;
  onSlugChange?: (slug: string) => void;
}) {
  const modpacksQuery = useQuery(
    trpc.admin.modpacks.list.queryOptions(undefined, {
      enabled: open,
    }),
  );
  const modpack = modpacksQuery.data?.find(
    (row) => row.id === workshop?.modpackId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Workshop Settings</DialogTitle>
        </DialogHeader>
        {modpacksQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          workshop && (
            <SettingsForm
              workshop={workshop}
              hasMods={hasMods}
              publishedPackId={modpack?.curseforgeProjectId ?? null}
              onOpenChange={onOpenChange}
              onSlugChange={onSlugChange}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({
  workshop,
  hasMods,
  publishedPackId: currentPublishedPackId,
  onOpenChange,
  onSlugChange,
}: {
  workshop: WorkshopSettings;
  hasMods: boolean;
  publishedPackId: number | null;
  onOpenChange: (open: boolean) => void;
  onSlugChange?: (slug: string) => void;
}) {
  const toast = useToastActions();

  const [name, setName] = useState(workshop.name);
  const [slug, setSlug] = useState(workshop.slug);
  const [description, setDescription] = useState(workshop.description ?? "");
  const [maxMods, setMaxMods] = useState(String(workshop.maxModsPerUser));
  const [maxUpvotes, setMaxUpvotes] = useState(
    String(workshop.maxUpvotesPerUser),
  );
  const [forumChannelId, setForumChannelId] = useState(
    workshop.discordForumChannelId ?? "",
  );
  const [basePackId, setBasePackId] = useState(
    workshop.baseModpackProjectId ? String(workshop.baseModpackProjectId) : "",
  );
  const [publishedPackId, setPublishedPackId] = useState(
    currentPublishedPackId ? String(currentPublishedPackId) : "",
  );

  const updateMutation = useMutation(
    trpc.admin.workshops.update.mutationOptions(useMutationToast()),
  );
  const updateModpackMutation = useMutation(
    trpc.admin.modpacks.update.mutationOptions(useMutationToast()),
  );
  const pending = updateMutation.isPending || updateModpackMutation.isPending;

  const handleSave = async () => {
    const validationError = workshopFormError({
      maxMods,
      maxUpvotes,
      basePackId: hasMods ? "" : basePackId,
      forumChannelId,
      publishedPackId,
      slug,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const nextPublishedPackId = publishedPackId.trim()
      ? Number(publishedPackId)
      : null;
    const nextSlug = slug.trim();

    try {
      const updated = await updateMutation.mutateAsync({
        workshopId: workshop.id,
        patch: {
          name: name.trim(),
          ...(nextSlug !== workshop.slug ? { slug: nextSlug } : {}),
          description: description.trim() || null,
          maxModsPerUser: Number(maxMods),
          maxUpvotesPerUser: Number(maxUpvotes),
          discordForumChannelId: forumChannelId.trim() || null,
          ...(hasMods
            ? {}
            : {
                baseModpackProjectId: basePackId.trim()
                  ? Number(basePackId)
                  : null,
              }),
        },
      });

      if (updated.slug !== workshop.slug) {
        queryClient.setQueryData(trpc.admin.workshops.list.queryKey(), (rows) =>
          rows?.map((row) =>
            row.id === workshop.id ? { ...row, slug: updated.slug } : row,
          ),
        );
        onSlugChange?.(updated.slug);
      }

      if (nextPublishedPackId !== currentPublishedPackId) {
        await updateModpackMutation.mutateAsync({
          modpackId: workshop.modpackId,
          patch: { curseforgeProjectId: nextPublishedPackId },
        });
      }
    } catch {
      return;
    }

    toast.success("Workshop settings saved");
    void queryClient.invalidateQueries(trpc.admin.workshops.list.pathFilter());
    void queryClient.invalidateQueries(trpc.admin.modpacks.list.pathFilter());
    void queryClient.invalidateQueries(
      trpc.admin.workshops.listPackMods.pathFilter(),
    );
    void queryClient.invalidateQueries(
      trpc.admin.workshops.attention.pathFilter(),
    );
    void queryClient.invalidateQueries(trpc.user.workshops.list.pathFilter());
    void queryClient.invalidateQueries(trpc.user.workshops.get.pathFilter());
    onOpenChange(false);
  };

  return (
    <>
      <div className="space-y-4">
        <Field>
          <FieldLabel htmlFor="settings-name">Name</FieldLabel>
          <Input
            id="settings-name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-slug">URL Slug</FieldLabel>
          <Input
            id="settings-slug"
            maxLength={100}
            value={slug}
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
            }
          />
          <p className="text-xs text-muted-foreground">
            The workshop's address: /workshop/{slug.trim() || "..."}. Changing
            it breaks previously shared links.
          </p>
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-desc">Description</FieldLabel>
          <Input
            id="settings-desc"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="settings-max">
              Suggestions per Player
            </FieldLabel>
            <Input
              id="settings-max"
              type="number"
              min={1}
              max={25}
              value={maxMods}
              onChange={(e) => setMaxMods(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-max-upvotes">
              Upvotes per Player
            </FieldLabel>
            <Input
              id="settings-max-upvotes"
              type="number"
              min={1}
              max={100}
              value={maxUpvotes}
              onChange={(e) => setMaxUpvotes(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="settings-published">
            Published Modpack Project ID (Optional)
          </FieldLabel>
          <Input
            id="settings-published"
            type="number"
            placeholder="CurseForge project the pack is published under"
            value={publishedPackId}
            onChange={(e) => setPublishedPackId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Set this once the pack is on CurseForge. It is what "Check Published
            Pack" reads, and it applies to every workshop feeding this modpack.
          </p>
        </Field>
        {!hasMods && (
          <Field>
            <FieldLabel htmlFor="settings-basepack">
              Base Modpack ID (Optional)
            </FieldLabel>
            <Input
              id="settings-basepack"
              type="number"
              value={basePackId}
              onChange={(e) => setBasePackId(e.target.value)}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="settings-forum">
            Discord Forum Channel ID (Optional)
          </FieldLabel>
          <Input
            id="settings-forum"
            placeholder="Forum for per-suggestion discussion threads"
            value={forumChannelId}
            onChange={(e) => setForumChannelId(e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button
          onClick={handleSave}
          disabled={!name.trim() || !slug.trim()}
          loading={pending}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
