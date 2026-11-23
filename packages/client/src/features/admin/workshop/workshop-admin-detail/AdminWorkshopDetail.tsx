import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Hammer, PackagePlus, Settings2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { ModDetailDialog } from "@/features/workshop/workshop-detail/components/ModDetailDialog";
import { WORKSHOP_STATUS_STYLES } from "@/features/workshop/format";
import { WORKSHOP_STATUS_TRANSITIONS } from "@createrington/shared/workshop";
import type { WorkshopModStatus } from "@createrington/shared/db";
import type { ModTableProps } from "@/features/admin/workshop/workshop-admin-detail/actions";
import { invalidateWorkshopMods } from "@/features/admin/workshop/workshop-admin-detail/invalidate";
import type { AdminWorkshopMod } from "@/features/admin/workshop/workshop-admin-detail/types";
import {
  STAGE_CONFIG,
  isModTab,
  isStageTab,
  isWorkshopTabId,
  tabGroup,
  type ModTabId,
  type TopTabId,
  type WorkshopTabId,
} from "@/features/admin/workshop/workshop-admin-detail/tabs";
import { useEnvironmentFlags } from "@/features/admin/workshop/workshop-admin-detail/hooks/use-environment-flags";
import { useWorkshopHotkeys } from "@/features/admin/workshop/workshop-admin-detail/hooks/use-workshop-hotkeys";
import { useWorkshopReview } from "@/features/admin/workshop/workshop-admin-detail/hooks/use-workshop-review";
import { AddModsDialog } from "@/features/admin/workshop/workshop-admin-detail/components/AddModsDialog";
import { ConfirmActionDialog } from "@/features/admin/workshop/workshop-admin-detail/components/ConfirmActionDialog";
import { RejectModDialog } from "@/features/admin/workshop/workshop-admin-detail/components/RejectModDialog";
import { WorkshopSettingsDialog } from "@/features/admin/workshop/workshop-admin-detail/components/WorkshopSettingsDialog";
import {
  WorkshopGroupTabs,
  WorkshopModTabs,
} from "@/features/admin/workshop/workshop-admin-detail/components/WorkshopTabs";
import { ActivityTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/ActivityTab";
import { AllModsTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/AllModsTab";
import { DependenciesTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/DependenciesTab";
import { InPackTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/InPackTab";
import { IssuesTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/IssuesTab";
import { ReleasesTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/ReleasesTab";
import { StageTab } from "@/features/admin/workshop/workshop-admin-detail/components/tabs/StageTab";

export function AdminWorkshopDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const workshopsQuery = useQuery(trpc.admin.workshops.list.queryOptions());
  const workshop = workshopsQuery.data?.find((row) => row.slug === slug);

  const workshopId = workshop?.id ?? 0;
  const enabled = workshopId > 0;
  const modsQuery = useQuery(
    trpc.admin.workshops.listMods.queryOptions({ workshopId }, { enabled }),
  );
  const packModsQuery = useQuery(
    trpc.admin.workshops.listPackMods.queryOptions({ workshopId }, { enabled }),
  );
  const attentionQuery = useQuery(
    trpc.admin.workshops.attention.queryOptions({ workshopId }, { enabled }),
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: WorkshopTabId = isWorkshopTabId(tabParam)
    ? tabParam
    : "review";

  const [search, setSearch] = useState("");
  const [detailModId, setDetailModId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const invalidate = () => invalidateWorkshopMods(workshopId);
  const mods = useMemo(() => modsQuery.data ?? [], [modsQuery.data]);

  const environment = useEnvironmentFlags({
    attention: attentionQuery.data,
    keepFlaggedIssues: activeTab === "issues",
    onChanged: invalidate,
  });
  const review = useWorkshopReview({ workshopId, mods, onChanged: invalidate });

  const setActiveTab = (tab: WorkshopTabId) => {
    if (tab === activeTab) return;
    const next = new URLSearchParams(searchParams);
    if (tab === "review") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
    setSearch("");
    environment.releaseFlaggedIssues();
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

  const updateWorkshopMutation = useMutation(
    trpc.admin.workshops.update.mutationOptions(
      useMutationToast({
        success: "Workshop updated",
        onSuccess: () => {
          void queryClient.invalidateQueries(
            trpc.admin.workshops.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.list.pathFilter(),
          );
          void queryClient.invalidateQueries(
            trpc.user.workshops.get.pathFilter(),
          );
        },
      }),
    ),
  );

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

  const modTable: ModTableProps = {
    isLoading: modsQuery.isLoading,
    error: modsQuery.error?.message ?? null,
    onRetry: () => void modsQuery.refetch(),
    search,
    onSearchChange: setSearch,
    busyModId: review.busyModId,
    onView: setDetailModId,
    envDisplay: environment.envDisplay,
    onSetEnvironment: environment.setEnvironment,
    onReview: review.review,
    onReject: review.openReject,
  };

  if (workshopsQuery.isLoading) {
    return <LoadingState text="Loading workshop..." />;
  }

  if (workshopsQuery.error) {
    return (
      <ErrorState
        message={workshopsQuery.error.message}
        onRetry={() => workshopsQuery.refetch()}
      />
    );
  }

  if (!workshop) {
    return <EmptyState icon={Hammer} message="Workshop not found" />;
  }

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Tools", href: "/admin/tools" },
        { label: "Workshop", href: "/admin/tools/workshop" },
        { label: workshop.name },
      ]}
    >
      <AdminPageTitle
        title={workshop.name}
        actions={
          <>
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
              <SelectTrigger className="w-full xs:w-32">
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
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-2 size-4" />
              Settings
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <PackagePlus className="mr-2 size-4" />
              Add Projects
            </Button>
          </>
        }
      />

      <Tabs
        value={tabGroup(activeTab)}
        onValueChange={(group) => openGroup(group as TopTabId)}
        className={isModTab(activeTab) ? "gap-3" : "gap-4"}
      >
        <WorkshopGroupTabs activeTab={activeTab} counts={counts} />

        <TabsContent
          value={tabGroup(activeTab)}
          tabIndex={-1}
          className="flex flex-col gap-4"
        >
          {isModTab(activeTab) && (
            <Tabs
              value={activeTab}
              onValueChange={(tab) => setActiveTab(tab as ModTabId)}
              className="gap-4"
            >
              <WorkshopModTabs activeTab={activeTab} counts={counts} />

              <TabsContent
                value={activeTab}
                tabIndex={-1}
                className="flex flex-col gap-4"
              >
                {isStageTab(activeTab) && (
                  <StageTab
                    {...modTable}
                    stage={activeTab}
                    mods={modsByStatus[STAGE_CONFIG[activeTab].status] ?? []}
                  />
                )}

                {activeTab === "all" && (
                  <AllModsTab {...modTable} mods={mods} />
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
                    envDisplay={environment.envDisplay}
                    onSetEnvironment={environment.setEnvironment}
                  />
                )}
              </TabsContent>
            </Tabs>
          )}

          {activeTab === "dependencies" && (
            <DependenciesTab
              workshopId={workshopId}
              search={search}
              onSearchChange={setSearch}
              onAddProject={review.addProject}
              busyProjectId={review.busyProjectId}
            />
          )}

          {activeTab === "issues" && (
            <IssuesTab
              workshopId={workshopId}
              items={environment.issueItems}
              isLoading={attentionQuery.isLoading}
              error={attentionQuery.error?.message ?? null}
              onRetry={() => attentionQuery.refetch()}
              onView={setDetailModId}
              onResolved={invalidate}
              unresolvedCount={attentionCount ?? 0}
              envDisplay={environment.envDisplay}
              onSetEnvironment={environment.setEnvironment}
            />
          )}

          {activeTab === "activity" && (
            <ActivityTab
              workshopId={workshopId}
              search={search}
              onSearchChange={setSearch}
              onView={setDetailModId}
            />
          )}

          {activeTab === "releases" && (
            <ReleasesTab modpackId={workshop.modpackId} />
          )}
        </TabsContent>
      </Tabs>

      <ModDetailDialog
        workshopModId={detailModId}
        onOpenChange={(open) => !open && setDetailModId(null)}
        admin
      />

      <AddModsDialog
        key={workshopId}
        open={addOpen}
        onOpenChange={setAddOpen}
        workshopId={workshopId}
        workshopClassId={workshop.classId}
        onAdded={invalidate}
      />

      <WorkshopSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        workshop={workshop}
        hasMods={mods.length > 0}
        onSlugChange={(nextSlug) =>
          navigate(`/admin/tools/workshop/${nextSlug}`, { replace: true })
        }
      />

      <ConfirmActionDialog
        target={review.confirmTarget}
        onOpenChange={(open) => {
          if (!open) review.closeConfirm();
        }}
        onConfirm={review.confirm}
      />

      <RejectModDialog
        target={review.rejectTarget}
        onOpenChange={(open) => {
          if (!open) review.closeReject();
        }}
        onReject={review.reject}
        pending={review.rejectPending}
      />
    </AdminPage>
  );
}
