import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  modpackManifestUploadSchema,
  type ModpackManifestUpload,
} from "@createrington/shared/workshop";
import { trpc, queryClient } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { useMutationToast } from "@/hooks/use-mutation-toast";

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;

export function useManifestImport({
  modpackId,
  memberCount,
  onImported,
}: {
  modpackId: number;
  memberCount: number | null;
  onImported: () => void;
}) {
  const toast = useToastActions();
  const [pendingManifest, setPendingManifest] =
    useState<ModpackManifestUpload | null>(null);

  const seedMutation = useMutation(
    trpc.admin.modpacks.seedFromManifest.mutationOptions(
      useMutationToast({
        onSuccess: (result) => {
          if (result.unresolvedProjectIds.length > 0) {
            toast.warning(
              `Imported ${result.memberCount} mods, ${result.unresolvedProjectIds.length} could not be resolved on CurseForge`,
            );
          } else if (result.duplicateProjectIds.length > 0) {
            toast.warning(
              `Imported ${result.memberCount} mods, ${result.duplicateProjectIds.length} listed more than once in the manifest and were merged`,
            );
          } else {
            toast.success(
              `Imported ${result.memberCount} mods from the manifest`,
            );
          }
          onImported();
          void queryClient.invalidateQueries(
            trpc.admin.modpacks.list.pathFilter(),
          );
        },
      }),
    ),
  );

  const importFile = async (file: File) => {
    if (file.size > MAX_MANIFEST_BYTES) {
      toast.error("That file is too large to be a modpack manifest.json");
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      toast.error("Could not read that file as JSON");
      return;
    }
    const parsed = modpackManifestUploadSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error("That file does not look like a modpack manifest.json");
      return;
    }
    if (memberCount === null) {
      toast.error("Wait for the pack members to load, then import again");
      return;
    }
    if (memberCount === 0) {
      seedMutation.mutate({ modpackId, manifest: parsed.data });
      return;
    }
    setPendingManifest(parsed.data);
  };

  const confirmPending = () =>
    pendingManifest
      ? seedMutation.mutateAsync({ modpackId, manifest: pendingManifest })
      : undefined;

  return {
    importFile,
    importing: seedMutation.isPending,
    pendingManifest,
    cancelPending: () => setPendingManifest(null),
    confirmPending,
  };
}
