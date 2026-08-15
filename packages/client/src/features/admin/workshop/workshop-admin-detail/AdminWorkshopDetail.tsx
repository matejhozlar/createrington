import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
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
import { WORKSHOP_STATUS_STYLES } from "@/features/workshop/format";
import {
  WORKSHOP_STATUS_TRANSITIONS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";
import type { WorkshopModStatus } from "@createrington/shared/db";
import type { AdminWorkshopMod } from "./types";
import {
  STAGE_CONFIG,
  isModTab,
  isStageTab,
  isWorkshopTabId,
  type ModTabId,
  type TopTabId,
  type WorkshopTabId,
} from "./tabs";
import { useWorkshopHotkeys } from "./hooks/use-workshop-hotkeys";
import { AddModsDialog } from "./components/AddModsDialog";
import { RejectModDialog } from "./components/RejectModDialog";
import { WorkshopSettingsDialog } from "./components/WorkshopSettingsDialog";
import { WorkshopTabs } from "./components/WorkshopTabs";
import { AllModsTab } from "./components/tabs/AllModsTab";
import { DependenciesTab } from "./components/tabs/DependenciesTab";
import { InPackTab } from "./components/tabs/InPackTab";
import { IssuesTab } from "./components/tabs/IssuesTab";
import { ReleasesTab } from "./components/tabs/ReleasesTab";
import { StageTab } from "./components/tabs/StageTab";

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
  const { slug } = useParams<{ slug: string }>();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const workshopsQuery = trpc.admin.workshops.list.useQuery();
  const workshop = workshopsQuery.data?.find((row) => row.slug === slug);

  const workshopId = workshop?.id ?? 0;
  const enabled = workshopId > 0;
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

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: WorkshopTabId = isWorkshopTabId(tabParam)
    ? tabParam
    : "review";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detailModId, setDetailModId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [rejectTarget, setRejectTarget] = useState<{
    workshopModId: number;
    name: string;
  } | null>(null);
  const [rejectKey, setRejectKey] = useState(0);

  const setActiveTab = (tab: WorkshopTabId) => {
    if (tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    if (tab === "review") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
    setSearch("");
    setPage(0);
  };

  const lastModTab = useRef<ModTabId>("review");
  useEffect(() => {
    if (isModTab(activeTab)) lastModTab.current = activeTab;
  }, [activeTab]);

  const openGroup = (group: TopTabId) =>
    setActiveTab(group === "mods" ? lastModTab.current : group);

  useWorkshopHotkeys({
    activeTab,
    onTabChange: setActiveTab,
    onOpenGroup: openGroup,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const openReject = (target: { workshopModId: number; name: string }) => {
    setRejectKey((key) => key + 1);
    setRejectTarget(target);
  };

  const invalidate = () => {
    utils.admin.workshops.listMods.invalidate({ workshopId });
    utils.admin.workshops.getMod.invalidate();
    utils.admin.workshops.searchProjects.invalidate({ workshopId });
    utils.admin.workshops.listPackMods.invalidate({ workshopId });
    utils.admin.workshops.getAttention.invalidate({ workshopId });
    utils.admin.workshops.listDependencies.invalidate({ workshopId });
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

  const addProjectMutation = trpc.admin.workshops.addMods.useMutation({
    onSuccess: () => {
      toast.success("Added to the workshop as approved");
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

  const modsByStatus = useMemo(() => {
    const groups: Partial<Record<WorkshopModStatus, AdminWorkshopMod[]>> = {};
    for (const mod of mods) (groups[mod.status] ??= []).push(mod);
    return groups;
  }, [mods]);

  const stageCount = (status: WorkshopModStatus) =>
    modsQuery.data ? (modsByStatus[status]?.length ?? 0) : undefined;
  const attentionCount = attentionQuery.data?.length;
  const counts: Partial<Record<WorkshopTabId, number>> = {
    review: stageCount("pending"),
    approved: stageCount("approved"),
    testing: stageCount("testing"),
    "next-update": stageCount("next_update"),
    "in-pack": packModsQuery.data?.length,
    "ruled-out": stageCount("rejected"),
    all: modsQuery.data?.length,
    issues:
      attentionCount !== undefined && attentionCount > 0
        ? attentionCount
        : undefined,
  };

  const busyModId = reviewMutation.isPending
    ? (reviewMutation.variables?.workshopModId ?? null)
    : null;
  const busyProjectId = addProjectMutation.isPending
    ? (addProjectMutation.variables?.projectIds[0] ?? null)
    : null;

  const handleReview = (id: number, action: WorkshopModReviewAction) =>
    reviewMutation.mutate({ workshopModId: id, action });
  const addProject = (projectId: number) =>
    addProjectMutation.mutate({ workshopId, projectIds: [projectId] });

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
          <h1 className="text-2xl font-semibold">{workshop.name}</h1>
          <div className="flex w-full flex-col gap-2 min-[440px]:w-auto min-[440px]:flex-row min-[440px]:items-center">
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
              <SelectTrigger className="w-full min-[440px]:w-32">
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

        <WorkshopTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onGroupChange={openGroup}
          counts={counts}
        />

        {isStageTab(activeTab) && (
          <StageTab
            stage={activeTab}
            mods={modsByStatus[STAGE_CONFIG[activeTab].status] ?? []}
            isLoading={modsQuery.isLoading}
            error={modsQuery.error?.message ?? null}
            onRetry={() => modsQuery.refetch()}
            search={search}
            onSearchChange={handleSearchChange}
            page={page}
            onPageChange={setPage}
            busyModId={busyModId}
            onView={setDetailModId}
            onReview={handleReview}
            onReject={openReject}
          />
        )}

        {activeTab === "all" && (
          <AllModsTab
            mods={mods}
            isLoading={modsQuery.isLoading}
            error={modsQuery.error?.message ?? null}
            onRetry={() => modsQuery.refetch()}
            search={search}
            onSearchChange={handleSearchChange}
            page={page}
            onPageChange={setPage}
            busyModId={busyModId}
            onView={setDetailModId}
            onReview={handleReview}
            onReject={openReject}
          />
        )}

        {activeTab === "in-pack" && (
          <InPackTab
            workshopId={workshopId}
            modpackId={workshop.modpackId}
            rows={packModsQuery.data ?? []}
            isLoading={packModsQuery.isLoading}
            error={packModsQuery.error?.message ?? null}
            onRetry={() => packModsQuery.refetch()}
            search={search}
            onSearchChange={setSearch}
            onReconciled={invalidate}
          />
        )}

        {activeTab === "dependencies" && (
          <DependenciesTab
            workshopId={workshopId}
            search={search}
            onSearchChange={setSearch}
            onAddProject={addProject}
            busyProjectId={busyProjectId}
          />
        )}

        {activeTab === "issues" && (
          <IssuesTab
            items={attentionQuery.data ?? []}
            isLoading={attentionQuery.isLoading}
            error={attentionQuery.error?.message ?? null}
            onRetry={() => attentionQuery.refetch()}
            onView={setDetailModId}
            onAddProject={addProject}
            busyProjectId={busyProjectId}
          />
        )}

        {activeTab === "releases" && (
          <ReleasesTab modpackId={workshop.modpackId} />
        )}
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
        key={`settings-${settingsKey}`}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workshop={workshop}
        hasMods={mods.length > 0}
      />

      <RejectModDialog
        key={`reject-${rejectKey}`}
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
