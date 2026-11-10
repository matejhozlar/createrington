import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { LoadingState } from "@/components/query-states";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { PackHeader } from "./components/PackHeader";
import { ModsList } from "./components/ModsList";
import { EditPackDialog } from "./components/EditPackDialog";
import { AddModDialog } from "./components/AddModDialog";
import { RemoveModDialog } from "./components/RemoveModDialog";
import type { RemoveTarget } from "./types";
import { useQuery, useMutation } from "@tanstack/react-query";

/** Detail view for a single structure pack: displays pack metadata, mod list, and dialogs for adding/removing mods with dependency resolution */
export function StructurePackDetail() {
  const { id } = useParams<{ id: string }>();
  const packId = parseInt(id ?? "0", 10);
  const navigate = useNavigate();

  const packQuery = useQuery(
    trpc.admin.structurePacks.get.queryOptions(
      { id: packId },
      { enabled: packId > 0 },
    ),
  );
  const pack = packQuery.data;

  const [editing, setEditing] = useState(false);
  const [addModOpen, setAddModOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);

  const deleteMutation = useMutation(
    trpc.admin.structurePacks.delete.mutationOptions(
      useMutationToast({
        success: "Pack deleted",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.list.pathFilter(),
          );
          void navigate("/admin/tools/structure-packs");
        },
      }),
    ),
  );

  const toggleEnabledMutation = useMutation(
    trpc.admin.structurePacks.toggleEnabled.mutationOptions(
      useMutationToast({
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.get.queryFilter({ id: packId }),
          );
          void queryClient.invalidateQueries(
            trpc.admin.structurePacks.list.pathFilter(),
          );
        },
      }),
    ),
  );

  if (packQuery.isLoading) {
    return (
      <LoadingState
        size="large"
        text="Loading pack..."
        className="h-screen flex-none py-0"
      />
    );
  }

  if (!pack) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">Pack not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Structure Packs", href: "/admin/tools/structure-packs" },
          { label: pack.name },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <PackHeader
          pack={pack}
          onEdit={() => setEditing(true)}
          onDelete={() => deleteMutation.mutate({ id: packId })}
          onToggleEnabled={(enabled) =>
            toggleEnabledMutation.mutate({ id: packId, enabled })
          }
        />

        {pack.description && (
          <p className="text-sm text-muted-foreground">{pack.description}</p>
        )}

        <ModsList
          mods={pack.mods}
          onAdd={() => setAddModOpen(true)}
          onRemove={setRemoveTarget}
        />
      </div>

      {editing && (
        <EditPackDialog
          onClose={() => setEditing(false)}
          packId={packId}
          initialName={pack.name}
          initialDescription={pack.description ?? ""}
        />
      )}

      <AddModDialog
        open={addModOpen}
        onOpenChange={setAddModOpen}
        packId={packId}
        packMods={pack.mods}
      />

      <RemoveModDialog
        target={removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        packId={packId}
        packMods={pack.mods}
      />
    </div>
  );
}
