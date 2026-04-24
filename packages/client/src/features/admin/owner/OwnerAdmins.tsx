import { useCallback, useState } from "react";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Copy, UserMinus, UserPlus } from "lucide-react";
import { PlayerLabel } from "@/components/player-label";
import { trpc } from "@/lib/trpc";
import { useToastActions } from "@/hooks/use-toast";
import { formatRelativeDate } from "@/features/admin/format";
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

  const handleCopy = useCallback(
    async (e: React.MouseEvent, text: string, label: string) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        toast.info(`${label} copied`);
      } catch {
        toast.error(`Failed to copy ${label}`);
      }
    },
    [toast],
  );

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Owner</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Admins</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Discord ID</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8">
                      <Loading size="medium" text="Loading admins..." />
                    </TableCell>
                  </TableRow>
                ) : adminsQuery.isError ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-destructive"
                    >
                      Failed to load admins: {adminsQuery.error.message}
                    </TableCell>
                  </TableRow>
                ) : admins.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No admins configured yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  admins.map((admin) => (
                    <TableRow key={admin.discordId}>
                      <TableCell className="px-4">
                        <PlayerLabel
                          uuid={admin.minecraftUuid}
                          name={admin.minecraftUsername}
                          size={28}
                        />
                      </TableCell>
                      <TableCell className="px-4">
                        <button
                          type="button"
                          onClick={(e) =>
                            handleCopy(e, admin.discordId, "Discord ID")
                          }
                          className="group/copy flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {admin.discordId}
                          <Copy className="size-3 opacity-0 transition-opacity group-hover/copy:opacity-100" />
                        </button>
                      </TableCell>
                      <TableCell className="px-4 text-sm text-muted-foreground">
                        {admin.createdAt
                          ? formatRelativeDate(admin.createdAt)
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDemoteTarget(admin)}
                        >
                          <UserMinus className="mr-1 size-3" />
                          Demote
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
