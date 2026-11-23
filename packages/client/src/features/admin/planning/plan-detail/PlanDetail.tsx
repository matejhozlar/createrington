import { useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileQuestion, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import { formatRelativeDate } from "@/lib/format";
import { queryClient, trpc } from "@/lib/trpc";
import {
  PLANNING_ITEM_STATUSES,
  type PlanningItemStatus,
} from "@createrington/shared/planning";
import { AssigneePicker } from "@/features/admin/planning/components/AssigneePicker";
import {
  CategoryBadges,
  StatusBadge,
} from "@/features/admin/planning/components/PlanBadges";
import { PlanFormDialog } from "@/features/admin/planning/components/PlanFormDialog";
import { PlanMarkdown } from "@/features/admin/planning/components/PlanMarkdown";
import { SourceLink } from "@/features/admin/planning/components/SourceLink";
import { STATUS_CONFIG } from "@/features/admin/planning/constants";
import { personName, subcategoryName } from "@/features/admin/planning/format";
import { PlanComments } from "./components/PlanComments";
import { PlanHistory } from "./components/PlanHistory";

const PLANNING_PATH = "/admin/planning";

export function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const planId = Number(id);
  const validId = Number.isInteger(planId) && planId > 0;
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const detailQuery = useQuery(
    trpc.admin.planning.items.get.queryOptions(
      { id: planId },
      { enabled: validId },
    ),
  );
  const subcategoriesQuery = useQuery(
    trpc.admin.planning.subcategories.list.queryOptions(),
  );

  const invalidate = () =>
    queryClient.invalidateQueries(trpc.admin.planning.pathFilter());

  const changeStatus = useMutation(
    trpc.admin.planning.items.update.mutationOptions(
      useMutationToast({
        onSuccess: () => void invalidate(),
        onError: () => void invalidate(),
      }),
    ),
  );
  const setAssignees = useMutation(
    trpc.admin.planning.items.assignees.set.mutationOptions(
      useMutationToast({ onSuccess: () => void invalidate() }),
    ),
  );
  const deleteItem = useMutation(
    trpc.admin.planning.items.delete.mutationOptions(
      useMutationToast({
        success: "Plan deleted",
        onSuccess: () => {
          void invalidate();
          void navigate(PLANNING_PATH);
        },
      }),
    ),
  );

  if (!validId) {
    return <EmptyState icon={FileQuestion} message="Invalid plan id." />;
  }

  if (detailQuery.isLoading) {
    return <LoadingState className="py-10" />;
  }

  if (detailQuery.isError && detailQuery.error.data?.code !== "NOT_FOUND") {
    return (
      <ErrorState
        message={detailQuery.error.message}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  if (!detailQuery.data) {
    return (
      <EmptyState icon={FileQuestion} message="Plan not found.">
        <NavLink to={PLANNING_PATH} className="text-primary underline">
          Back to planning
        </NavLink>
      </EmptyState>
    );
  }

  const { item, comments, revisions } = detailQuery.data;
  const subcategories = subcategoriesQuery.data?.subcategories ?? [];

  return (
    <AdminPage
      trail={[
        { label: "Admin", href: "/admin/dashboard" },
        { label: "Planning", href: PLANNING_PATH },
        { label: item.title },
      ]}
    >
      <AdminPageTitle
        title={item.title}
        badges={
          <>
            <StatusBadge status={item.status} />
            <CategoryBadges
              category={item.category}
              subcategory={subcategoryName(subcategories, item.subcategoryId)}
            />
          </>
        }
        description={
          <>
            <p className="text-xs">
              Added by{" "}
              <span className="font-medium">{personName(item.createdBy)}</span>{" "}
              {formatRelativeDate(item.createdAt)}, last edited by{" "}
              <span className="font-medium">{personName(item.updatedBy)}</span>{" "}
              {formatRelativeDate(item.updatedAt)}
            </p>
            {item.sourceUrl && (
              <SourceLink
                url={item.sourceUrl}
                label="Captured from Discord"
                className="-ml-2"
              />
            )}
          </>
        }
        actions={
          <>
            <Select
              value={item.status}
              disabled={changeStatus.isPending}
              onValueChange={(value) =>
                changeStatus.mutate({
                  id: item.id,
                  revision: item.revision,
                  status: value as PlanningItemStatus,
                })
              }
            >
              <SelectTrigger className="w-full xs:w-36" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNING_ITEM_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STATUS_CONFIG[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Delete plan"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {item.body ? (
                <PlanMarkdown text={item.body} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No description yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanComments itemId={item.id} comments={comments} />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Assigned to</CardTitle>
            </CardHeader>
            <CardContent>
              <AssigneePicker
                value={item.assignees.map((assignee) => assignee.discordId)}
                onChange={(discordIds) =>
                  setAssignees.mutate({ id: item.id, discordIds })
                }
                disabled={setAssignees.isPending}
              />
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">
                History ({revisions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlanHistory
                itemId={item.id}
                currentRevision={item.revision}
                revisions={revisions}
                subcategories={subcategories}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <PlanFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        item={item}
      />

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete Plan"
        description={
          <>
            Delete <span className="font-semibold">"{item.title}"</span> with
            its comments and its whole history? This cannot be undone.
          </>
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteItem.mutateAsync({ id: item.id })}
      />
    </AdminPage>
  );
}
