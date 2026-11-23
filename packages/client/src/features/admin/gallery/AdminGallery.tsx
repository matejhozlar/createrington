import { useState } from "react";
import { Settings2, Sparkles } from "lucide-react";
import { trpc, queryClient } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { LabeledSwitch } from "@/components/labeled-switch";
import { EmptyState, ErrorState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { ReviewPanel } from "./components/ReviewPanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { SubmissionGrid } from "./components/SubmissionGrid";
import { GALLERY_STATUS, type GalleryStatus } from "./format";
import { useQuery, useMutation } from "@tanstack/react-query";

const QUEUE_LIMIT = 50;

const INTAKE_FLAG = {
  name: "gallery",
  id: "gallery-intake-enabled",
  label: "Discord intake",
  description: "Screenshot gallery intake from the gallery-submissions channel",
} as const;

const TABS: { value: GalleryStatus; label: string }[] = [
  { value: "pending", label: GALLERY_STATUS.pending.label },
  { value: "approved", label: GALLERY_STATUS.approved.label },
  { value: "rejected", label: GALLERY_STATUS.rejected.label },
  { value: "withdrawn", label: GALLERY_STATUS.withdrawn.label },
];

const GRID_TABS = TABS.filter(
  (tab): tab is { value: Exclude<GalleryStatus, "pending">; label: string } =>
    tab.value !== "pending",
);

export function AdminGallery() {
  const [tab, setTab] = useState<GalleryStatus>("pending");
  const [cursor, setCursor] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const flagsQuery = useQuery(trpc.admin.features.list.queryOptions());
  const intakeEnabled =
    flagsQuery.data?.find((flag) => flag.name === INTAKE_FLAG.name)?.enabled ??
    false;

  const setFlagMutation = useMutation(
    trpc.admin.features.set.mutationOptions(
      useMutationToast({
        success: (flag) =>
          `${INTAKE_FLAG.label} ${flag.enabled ? "enabled" : "disabled"}`,
        onSuccess: () =>
          queryClient.invalidateQueries(trpc.admin.features.list.pathFilter()),
      }),
    ),
  );

  const queueQuery = useQuery(
    trpc.admin.gallery.list.queryOptions({
      status: "pending",
      page: 0,
      limit: QUEUE_LIMIT,
    }),
  );
  const queue = queueQuery.data?.items ?? [];
  const counts = queueQuery.data?.counts;
  const total = queueQuery.data?.pagination.total ?? 0;
  const index = queue.length === 0 ? 0 : Math.min(cursor, queue.length - 1);
  const current = queue[index];

  const detailQuery = useQuery(
    trpc.admin.gallery.get.queryOptions(
      { id: current?.id ?? 0 },
      { enabled: current !== undefined },
    ),
  );
  const detail =
    current && detailQuery.data?.id === current.id ? detailQuery.data : null;

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Tools", href: "/admin/tools" },
        { label: "Gallery" },
      ]}
    >
      <AdminPageTitle
        title="Gallery"
        description="Screenshots posted in the Discord submissions channel wait here for review. Approved ones are published on the website with credit, rewarded, and announced in the gallery channel."
        actions={
          <>
            <LabeledSwitch
              id={INTAKE_FLAG.id}
              label={INTAKE_FLAG.label}
              checked={intakeEnabled}
              disabled={
                flagsQuery.isLoading ||
                !!flagsQuery.error ||
                setFlagMutation.isPending
              }
              onCheckedChange={(checked) =>
                setFlagMutation.mutate({
                  name: INTAKE_FLAG.name,
                  enabled: checked,
                  description: INTAKE_FLAG.description,
                })
              }
            />
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-2 size-4" />
              Rewards
            </Button>
          </>
        }
      />

      {!flagsQuery.isLoading && !flagsQuery.error && !intakeEnabled && (
        <p className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
          Discord intake is off. New posts in the submissions channel are
          ignored until it is switched on.
        </p>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as GalleryStatus)}
      >
        <TabsList>
          {TABS.map((entry) => (
            <TabsTrigger
              key={entry.value}
              value={entry.value}
              className="cursor-pointer"
            >
              {entry.label}
              {counts && (
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {counts[entry.value]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pending" className="mt-2">
          {queueQuery.error ? (
            <Card>
              <ErrorState
                message={queueQuery.error.message}
                onRetry={() => queueQuery.refetch()}
              />
            </Card>
          ) : queueQuery.isLoading ? (
            <ReviewSkeleton />
          ) : !current ? (
            <EmptyQueue />
          ) : detail ? (
            <ReviewPanel
              key={detail.id}
              item={detail}
              position={index + 1}
              total={total}
              onPrev={() => setCursor(index - 1)}
              onNext={() => setCursor(index + 1)}
              onDecided={() => setCursor(index)}
            />
          ) : detailQuery.error ? (
            <Card>
              <ErrorState
                message={detailQuery.error.message}
                onRetry={() => detailQuery.refetch()}
              />
            </Card>
          ) : (
            <ReviewSkeleton />
          )}
        </TabsContent>

        {GRID_TABS.map((entry) => (
          <TabsContent key={entry.value} value={entry.value} className="mt-2">
            <SubmissionGrid key={entry.value} status={entry.value} />
          </TabsContent>
        ))}
      </Tabs>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </AdminPage>
  );
}

function EmptyQueue() {
  return (
    <Card>
      <EmptyState
        icon={Sparkles}
        message="All caught up"
        hint="New screenshots posted in the submissions channel show up here."
        className="py-16"
      />
    </Card>
  );
}

function ReviewSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-20" />
      </div>
      <CardContent className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
