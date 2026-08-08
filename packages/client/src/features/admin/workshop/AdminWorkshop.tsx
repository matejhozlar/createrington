import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { QueryErrorState } from "@/features/workshop/components/QueryErrorState";
import {
  WORKSHOP_STATUS_STYLES,
  formatDate,
  loaderName,
} from "@/features/workshop/format";
import { CreateWorkshopDialog } from "./components/CreateWorkshopDialog";

export function AdminWorkshop() {
  const navigate = useNavigate();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const workshopsQuery = trpc.admin.workshops.list.useQuery();
  const flagsQuery = trpc.admin.features.list.useQuery();
  const workshopFlag = flagsQuery.data?.find((f) => f.name === "workshop");

  const setFlagMutation = trpc.admin.features.set.useMutation({
    onSuccess: (flag) => {
      toast.success(`Workshop ${flag.enabled ? "enabled" : "disabled"}`);
      utils.admin.features.list.invalidate();
      utils.user.workshops.isEnabled.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop" },
        ]}
      >
        <div className="ml-auto flex items-center gap-2">
          <Label
            htmlFor="workshop-enabled"
            className="text-sm text-muted-foreground"
          >
            Feature Enabled
          </Label>
          <Switch
            id="workshop-enabled"
            checked={workshopFlag?.enabled ?? false}
            disabled={
              flagsQuery.isLoading ||
              !!flagsQuery.error ||
              setFlagMutation.isPending
            }
            onCheckedChange={(checked) =>
              setFlagMutation.mutate({
                name: "workshop",
                enabled: checked,
                description: "Workshop tab",
              })
            }
          />
        </div>
      </AdminPageHeader>

      <div className="mx-auto w-full max-w-[1100px] flex flex-1 flex-col gap-6 px-4 pb-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Workshops</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New Workshop
            </Button>
          </CardHeader>
          <CardContent>
            {workshopsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loading size="medium" text="Loading workshops..." />
              </div>
            ) : workshopsQuery.error ? (
              <QueryErrorState
                compact
                message={workshopsQuery.error.message}
                onRetry={() => workshopsQuery.refetch()}
              />
            ) : (workshopsQuery.data?.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No workshops yet, create the first one.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Cap</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workshopsQuery.data?.map((workshop) => (
                    <TableRow
                      key={workshop.id}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate(`/admin/tools/workshop/${workshop.id}`)
                      }
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/admin/tools/workshop/${workshop.id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="font-medium">{workshop.name}</div>
                        <div className="text-xs text-muted-foreground">
                          /{workshop.slug}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            WORKSHOP_STATUS_STYLES[workshop.status]?.className
                          }
                        >
                          {WORKSHOP_STATUS_STYLES[workshop.status]?.label ??
                            workshop.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {workshop.gameVersion} ·{" "}
                        {loaderName(workshop.modLoaderType)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {workshop.maxModsPerUser} mods
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(workshop.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {createOpen && (
        <CreateWorkshopDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </div>
  );
}
