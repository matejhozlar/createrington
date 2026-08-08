import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Hammer, Plus } from "lucide-react";
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

  const workshops = workshopsQuery.data ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Tools", href: "/admin/tools" },
          { label: "Workshop" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Workshop</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
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
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Workshop
            </Button>
          </div>
        </div>

        <Card className="gap-0">
          <CardHeader className="gap-0 border-b">
            <CardTitle>
              Workshops ({workshops.length.toLocaleString()})
            </CardTitle>
          </CardHeader>

          {workshopsQuery.isLoading ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <Loading size="medium" text="Loading workshops..." />
            </CardContent>
          ) : workshopsQuery.error ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <p className="text-destructive">
                  {workshopsQuery.error.message}
                </p>
                <Button
                  onClick={() => workshopsQuery.refetch()}
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          ) : workshops.length === 0 ? (
            <CardContent className="flex flex-1 items-center justify-center py-12">
              <div className="text-center">
                <Hammer className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">No workshops yet</p>
                <Button onClick={() => setCreateOpen(true)} className="mt-4">
                  <Plus className="mr-2 size-4" />
                  Create First Workshop
                </Button>
              </div>
            </CardContent>
          ) : (
            <CardContent className="px-0">
              <Table>
                <TableHeader className="bg-sidebar-accent/50">
                  <TableRow>
                    <TableHead className="px-4">Name</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                    <TableHead className="px-4">Target</TableHead>
                    <TableHead className="px-4">Cap</TableHead>
                    <TableHead className="px-4">Created</TableHead>
                    <TableHead className="px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workshops.map((workshop) => (
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
                      <TableCell className="px-4">
                        <p className="font-medium">{workshop.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{workshop.slug}
                        </p>
                      </TableCell>
                      <TableCell className="px-4">
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
                      <TableCell className="px-4 text-sm">
                        {workshop.gameVersion} ·{" "}
                        {loaderName(workshop.modLoaderType)}
                      </TableCell>
                      <TableCell className="px-4 text-sm">
                        {workshop.maxModsPerUser} mods
                      </TableCell>
                      <TableCell className="px-4 text-sm text-muted-foreground">
                        {formatDate(workshop.createdAt)}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      </div>

      {createOpen && (
        <CreateWorkshopDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </div>
  );
}
