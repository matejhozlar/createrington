import { useState } from "react";
import { AdminPage } from "@/features/admin/components/AdminPage";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CellDate, CellText } from "@/components/cell-text";
import { EmptyState, ErrorState } from "@/components/query-states";
import {
  AvatarCellSkeleton,
  DataTable,
  type DataTableColumn,
} from "@/components/data-table";
import { UserCog, UserMinus, UserPlus } from "lucide-react";
import { PlayerLabel } from "@/components/player-label";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { PromoteDialog } from "./components/PromoteDialog";
import { DemoteDialog } from "./components/DemoteDialog";
import { AuditFeed } from "./components/AuditFeed";
import { useQuery } from "@tanstack/react-query";

type AdminRow = {
  discordId: string;
  minecraftUuid: string | null;
  minecraftUsername: string | null;
  createdAt: string | null;
};

export function OwnerAdmins() {
  const toast = useToastActions();

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState<AdminRow | null>(null);

  const adminsQuery = useQuery(trpc.owner.admins.list.queryOptions());
  const auditQuery = useQuery(
    trpc.owner.admins.auditLog.queryOptions({ limit: 20 }),
  );

  const admins = adminsQuery.data?.admins ?? [];

  const columns: DataTableColumn<AdminRow>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 200,
      skeleton: () => <AvatarCellSkeleton />,
      render: (admin) => (
        <PlayerLabel
          uuid={admin.minecraftUuid}
          name={admin.minecraftUsername}
          size={28}
        />
      ),
    },
    {
      key: "discordId",
      header: "Discord ID",
      width: 210,
      render: (admin) => (
        <CellText
          copy
          value={admin.discordId}
          className="font-mono text-sm text-muted-foreground"
        />
      ),
    },
    {
      key: "since",
      header: "Since",
      width: 140,
      cellClassName: "text-sm text-muted-foreground",
      render: (admin) => <CellDate value={admin.createdAt} relative />,
    },
  ];

  return (
    <AdminPage
      trail={[
        { label: "Home", href: "/" },
        { label: "Owner" },
        { label: "Admins" },
      ]}
    >
      <AdminPageTitle
        title="Admins"
        description="Everyone with an entry in the DB admin table."
        actions={
          <Button onClick={() => setPromoteOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Promote
          </Button>
        }
      />
      <Card className="pt-0">
        <CardContent className="p-0">
          {adminsQuery.isError ? (
            <ErrorState
              message={`Failed to load admins: ${adminsQuery.error.message}`}
              onRetry={() => adminsQuery.refetch()}
              compact
            />
          ) : !adminsQuery.isLoading && admins.length === 0 ? (
            <EmptyState
              icon={UserCog}
              message="No admins configured yet."
              className="py-8"
            />
          ) : (
            <DataTable
              columns={columns}
              rows={admins}
              loading={adminsQuery.isLoading}
              rowKey={(admin) => admin.discordId}
              actions={(admin) => [
                {
                  label: "Demote",
                  icon: UserMinus,
                  variant: "destructive",
                  onClick: () => setDemoteTarget(admin),
                },
              ]}
              actionSlots={1}
            />
          )}
        </CardContent>
      </Card>

      <AuditFeed
        entries={auditQuery.data?.entries ?? []}
        isLoading={auditQuery.isLoading}
      />

      <PromoteDialog
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        onSuccess={({ minecraftUsername, discordRoleAdded }) => {
          toast.success(
            `Promoted ${minecraftUsername ?? "user"}${discordRoleAdded ? " + Discord role" : " (Discord role failed)"}`,
          );
          setPromoteOpen(false);
        }}
      />

      <DemoteDialog
        admin={demoteTarget}
        onClose={() => setDemoteTarget(null)}
        onSuccess={({
          minecraftUsername,
          removedFromDb,
          discordRoleRemoved,
          rconResults,
        }) => {
          const rconFailures = rconResults.filter((r) => !r.success).length;
          const bits = [
            removedFromDb ? "DB" : null,
            discordRoleRemoved ? "Discord role" : null,
            rconResults.length > 0
              ? `OP ${rconResults.length - rconFailures}/${rconResults.length}`
              : null,
          ].filter(Boolean);
          toast.success(
            `Demoted ${minecraftUsername ?? "user"} (${bits.join(", ")})`,
          );
          setDemoteTarget(null);
        }}
      />
    </AdminPage>
  );
}
