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
import { Skeleton } from "@/components/ui/skeleton";
import { workshopFormError } from "../../validation";

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
  workshop: WorkshopSettings;
  hasMods: boolean;
  onSlugChange?: (slug: string) => void;
}) {
  const modpacksQuery = trpc.admin.modpacks.list.useQuery(undefined, {
    enabled: open,
  });
  const modpack = modpacksQuery.data?.find(
    (row) => row.id === workshop.modpackId,
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
          <SettingsForm
            workshop={workshop}
            hasMods={hasMods}
            publishedPackId={modpack?.curseforgeProjectId ?? null}
            onOpenChange={onOpenChange}
            onSlugChange={onSlugChange}
          />
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
  const utils = trpc.useUtils();

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

  const updateMutation = trpc.admin.workshops.update.useMutation();
  const updateModpackMutation = trpc.admin.modpacks.update.useMutation();
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
        utils.admin.workshops.list.setData(undefined, (rows) =>
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save settings",
      );
      return;
    }

    toast.success("Workshop settings saved");
    utils.admin.workshops.list.invalidate();
    utils.admin.modpacks.list.invalidate();
    utils.admin.workshops.listPackMods.invalidate();
    utils.admin.workshops.getAttention.invalidate();
    utils.user.workshops.list.invalidate();
    utils.user.workshops.get.invalidate();
    onOpenChange(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-slug">URL Slug</Label>
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-desc">Description</Label>
          <Input
            id="settings-desc"
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="settings-max">Suggestions per Player</Label>
            <Input
              id="settings-max"
              type="number"
              min={1}
              max={25}
              value={maxMods}
              onChange={(e) => setMaxMods(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-max-upvotes">Upvotes per Player</Label>
            <Input
              id="settings-max-upvotes"
              type="number"
              min={1}
              max={100}
              value={maxUpvotes}
              onChange={(e) => setMaxUpvotes(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-published">
            Published Modpack Project ID (Optional)
          </Label>
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
        </div>
        {!hasMods && (
          <div className="space-y-2">
            <Label htmlFor="settings-basepack">
              Base Modpack ID (Optional)
            </Label>
            <Input
              id="settings-basepack"
              type="number"
              value={basePackId}
              onChange={(e) => setBasePackId(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="settings-forum">
            Discord Forum Channel ID (Optional)
          </Label>
          <Input
            id="settings-forum"
            placeholder="Forum for per-suggestion discussion threads"
            value={forumChannelId}
            onChange={(e) => setForumChannelId(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={handleSave}
          disabled={pending || !name.trim() || !slug.trim()}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
