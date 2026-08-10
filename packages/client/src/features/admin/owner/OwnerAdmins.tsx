import { useState } from "react";
import { Loading } from "@/components/loading-spinner";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CellText } from "@/components/cell-text";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { UserMinus, UserPlus } from "lucide-react";
import { PlayerLabel } from "@/components/player-label";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { formatFullDate, formatRelativeDate } from "@/features/admin/format";
import { PromoteDialog } from "./components/PromoteDialog";
import { DemoteDialog } from "./components/DemoteDialog";
import { AuditFeed } from "./components/AuditFeed";

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

  const adminsQuery = trpc.owner.admins.list.useQuery();
  const auditQuery = trpc.owner.admins.auditLog.useQuery({ limit: 20 });

  const admins = adminsQuery.data?.admins ?? [];

  const refetchAll = () => {
    void adminsQuery.refetch();
    void auditQuery.refetch();
  };

  const columns: DataTableColumn<AdminRow>[] = [
    {
      key: "player",
      header: "Player",
      minWidth: 200,
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
      render: (admin) =>
        admin.createdAt && (
          <CellText
            value={formatFullDate(admin.createdAt)}
            display={formatRelativeDate(admin.createdAt)}
          />
        ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4">
      <AdminPageHeader
        trail={[
          { label: "Home", href: "/" },
          { label: "Owner" },
          { label: "Admins" },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] flex flex-1 flex-col gap-4 px-4 pb-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Current admins ({admins.length})</CardTitle>
              <CardDescription>
                Everyone with an entry in the DB admin table.
              </CardDescription>
            </div>
            <Button onClick={() => setPromoteOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Promote
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {adminsQuery.isLoading ? (
              <div className="py-8">
                <Loading size="medium" text="Loading admins..." />
              </div>
            ) : adminsQuery.isError ? (
              <p className="py-8 text-center text-destructive">
                Failed to load admins: {adminsQuery.error.message}
              </p>
            ) : admins.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No admins configured yet.
              </p>
            ) : (
              <DataTable
                columns={columns}
                rows={admins}
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
      </div>

      <PromoteDialog
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        onSuccess={({ minecraftUsername, discordRoleAdded }) => {
          toast.success(
            `Promoted ${minecraftUsername ?? "user"}${discordRoleAdded ? " + Discord role" : " (Discord role failed)"}`,
          );
          setPromoteOpen(false);
          refetchAll();
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
          refetchAll();
        }}
      />
    </div>
  );
}
