import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Package } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { PackHeader } from "./components/PackHeader";
import { ModsList } from "./components/ModsList";
import { EditPackDialog } from "./components/EditPackDialog";
import { AddModDialog } from "./components/AddModDialog";
import { RemoveModDialog } from "./components/RemoveModDialog";
import type { RemoveTarget } from "./types";
import { useQuery, useMutation } from "@tanstack/react-query";

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

  if (packQuery.isError && packQuery.error.data?.code !== "NOT_FOUND") {
    return (
      <ErrorState
        message={packQuery.error.message}
        onRetry={() => packQuery.refetch()}
        className="h-screen flex-none py-0"
      />
    );
  }

  if (!pack) {
    return (
      <EmptyState
        icon={Package}
        message="Pack not found"
        className="h-screen flex-none py-0"
      />
    );
  }

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Tools", href: "/admin/tools" },
        { label: "Structure Packs", href: "/admin/tools/structure-packs" },
        { label: pack.name },
      ]}
    >
      <PackHeader
        pack={pack}
        onEdit={() => setEditing(true)}
        onDelete={() => deleteMutation.mutateAsync({ id: packId })}
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

      <EditPackDialog
        open={editing}
        onClose={() => setEditing(false)}
        packId={packId}
        initialName={pack.name}
        initialDescription={pack.description ?? ""}
      />

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
    </AdminPage>
  );
}
