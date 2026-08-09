import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { PackagePlus, Settings2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { ModDetailDialog } from "@/features/workshop/workshop-detail/components/ModDetailDialog";
import { WORKSHOP_STATUS_STYLES, loaderName } from "@/features/workshop/format";
import {
  WORKSHOP_STATUS_TRANSITIONS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";
import type { WorkshopModStatus } from "@createrington/shared/db";
import { AddModsDialog } from "./components/AddModsDialog";
import { AttentionCard } from "./components/AttentionCard";
import { PackMembersCard } from "./components/PackMembersCard";
import { RejectModDialog } from "./components/RejectModDialog";
import { SuggestionsCard } from "./components/SuggestionsCard";
import {
  SuggestionFilters,
  type StatusFilter,
} from "./components/SuggestionFilters";
import { WorkshopSettingsDialog } from "./components/WorkshopSettingsDialog";

const REVIEW_TOASTS: Partial<Record<WorkshopModStatus, string>> = {
  approved: "Mod approved",
  testing: "Mod moved to testing",
  next_update: "Mod approved, coming next update",
  rejected: "Mod rejected",
};

const SEND_BACK_TOASTS: Partial<Record<WorkshopModStatus, string>> = {
  approved: "Mod sent back, awaiting testing",
  testing: "Mod sent back to testing",
};

export function AdminWorkshopDetail() {
  const { id } = useParams<{ id: string }>();
  const workshopId = Number(id);
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const workshopsQuery = trpc.admin.workshops.list.useQuery();
  const workshop = workshopsQuery.data?.find((row) => row.id === workshopId);

  const enabled = Number.isFinite(workshopId);
  const modsQuery = trpc.admin.workshops.listMods.useQuery(
    { workshopId },
    { enabled },
  );
  const packModsQuery = trpc.admin.workshops.listPackMods.useQuery(
    { workshopId },
    { enabled },
  );
  const attentionQuery = trpc.admin.workshops.getAttention.useQuery(
    { workshopId },
    { enabled },
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [detailModId, setDetailModId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<{
    workshopModId: number;
    name: string;
  } | null>(null);

  const invalidate = () => {
    utils.admin.workshops.listMods.invalidate({ workshopId });
    utils.admin.workshops.getMod.invalidate();
    utils.admin.workshops.searchProjects.invalidate({ workshopId });
    utils.admin.workshops.listPackMods.invalidate({ workshopId });
    utils.admin.workshops.getAttention.invalidate({ workshopId });
    utils.user.workshops.list.invalidate();
    utils.user.workshops.get.invalidate();
    utils.user.workshops.listRejected.invalidate({ workshopId });
    utils.user.workshops.getPack.invalidate({ workshopId });
  };

  const reviewMutation = trpc.admin.workshops.reviewMod.useMutation({
    onSuccess: (mod, variables) => {
      const toasts =
        variables.action === "send_back" ? SEND_BACK_TOASTS : REVIEW_TOASTS;
      toast.success(toasts[mod.status] ?? "Mod updated");
      setRejectTarget(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateWorkshopMutation = trpc.admin.workshops.update.useMutation({
    onSuccess: () => {
      toast.success("Workshop updated");
      utils.admin.workshops.list.invalidate();
      utils.user.workshops.list.invalidate();
      utils.user.workshops.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const mods = useMemo(() => modsQuery.data ?? [], [modsQuery.data]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: mods.length };
    for (const mod of mods) tally[mod.status] = (tally[mod.status] ?? 0) + 1;
    return tally;
  }, [mods]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mods.filter((mod) => {
      if (statusFilter !== "all" && mod.status !== statusFilter) return false;
      if (!query) return true;
      return [mod.project.name, mod.project.slug, mod.submitterName].some(
        (value) => value?.toLowerCase().includes(query),
      );
    });
  }, [mods, statusFilter, search]);

  if (workshopsQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loading size="medium" text="Loading workshop..." />
      </div>
    );
  }

  if (workshopsQuery.error || !workshop) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-destructive">
          {workshopsQuery.error?.message ?? "Workshop not found"}
        </p>
        {workshopsQuery.error && (
          <Button variant="outline" onClick={() => workshopsQuery.refetch()}>
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop", href: "/admin/tools/workshop" },
          { label: workshop.name },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{workshop.name}</h1>
            <p className="text-sm text-muted-foreground">
              /{workshop.slug} · {workshop.gameVersion} ·{" "}
              {loaderName(workshop.modLoaderType)} · {workshop.maxModsPerUser}{" "}
              suggestions per player
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={workshop.status}
              disabled={updateWorkshopMutation.isPending}
              onValueChange={(status) =>
                updateWorkshopMutation.mutate({
                  workshopId,
                  patch: { status: status as typeof workshop.status },
                })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  workshop.status,
                  ...WORKSHOP_STATUS_TRANSITIONS[workshop.status],
                ].map((status) => (
                  <SelectItem key={status} value={status}>
                    {WORKSHOP_STATUS_STYLES[status]?.label ?? status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSettingsKey((key) => key + 1);
                setSettingsOpen(true);
              }}
            >
              <Settings2 className="mr-2 size-4" />
              Settings
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <PackagePlus className="mr-2 size-4" />
              Add Mods
            </Button>
          </div>
        </div>

        <AttentionCard
          items={attentionQuery.data ?? []}
          error={attentionQuery.error?.message ?? null}
          onRetry={() => attentionQuery.refetch()}
        />

        <SuggestionFilters
          search={search}
          onSearchChange={setSearch}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          counts={counts}
        />

        <SuggestionsCard
          mods={filtered}
          total={mods.length}
          isLoading={modsQuery.isLoading}
          error={modsQuery.error?.message ?? null}
          onRetry={() => modsQuery.refetch()}
          busyModId={
            reviewMutation.isPending
              ? (reviewMutation.variables?.workshopModId ?? null)
              : null
          }
          onView={setDetailModId}
          onReview={(id, action: WorkshopModReviewAction) =>
            reviewMutation.mutate({ workshopModId: id, action })
          }
          onReject={setRejectTarget}
        />

        <PackMembersCard
          rows={packModsQuery.data ?? []}
          workshopId={workshopId}
          isLoading={packModsQuery.isLoading}
          error={packModsQuery.error?.message ?? null}
          onRetry={() => packModsQuery.refetch()}
        />
      </div>

      <ModDetailDialog
        workshopModId={detailModId}
        onOpenChange={(open) => !open && setDetailModId(null)}
        admin
      />

      <AddModsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        workshopId={workshopId}
        onAdded={invalidate}
      />

      <WorkshopSettingsDialog
        key={settingsKey}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workshop={workshop}
        hasMods={mods.length > 0}
      />

      <RejectModDialog
        target={rejectTarget}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null);
        }}
        onReject={(input) =>
          reviewMutation.mutate({ ...input, action: "reject" })
        }
        pending={reviewMutation.isPending}
      />
    </div>
  );
}
