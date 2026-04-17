import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loading } from "@/components/loading-spinner";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { PackHeader } from "./components/PackHeader";
import { ModsList } from "./components/ModsList";
import { EditPackDialog } from "./components/EditPackDialog";
import { AddModDialog } from "./components/AddModDialog";
import { RemoveModDialog } from "./components/RemoveModDialog";
import type { RemoveTarget } from "./types";

/** Detail view for a single structure pack — displays pack metadata, mod list, and dialogs for adding/removing mods with dependency resolution */
export function StructurePackDetail() {
  const { id } = useParams<{ id: string }>();
  const packId = parseInt(id ?? "0", 10);
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const packQuery = trpc.admin.structurePacks.get.useQuery(
    { id: packId },
    { enabled: packId > 0 },
  );
  const pack = packQuery.data;

  // Dialog visibility state
  const [editing, setEditing] = useState(false);
  const [addModOpen, setAddModOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);

  const deleteMutation = trpc.admin.structurePacks.delete.useMutation({
    onSuccess: () => {
      toast.success("Pack deleted");
      utils.admin.structurePacks.list.invalidate();
      navigate("/admin/tools/structure-packs");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleEnabledMutation =
    trpc.admin.structurePacks.toggleEnabled.useMutation({
      onSuccess: () => {
        utils.admin.structurePacks.get.invalidate({ id: packId });
        utils.admin.structurePacks.list.invalidate();
      },
      onError: (err) => toast.error(err.message),
    });

  if (packQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading size="large" text="Loading pack..." />
      </div>
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
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools">Tools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/tools/structure-packs">
                Structure Packs
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pack.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

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
