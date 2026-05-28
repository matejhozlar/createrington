import { WhitelistResync } from "./WhitelistResync";

interface ServerManagementProps {
  serverId: number;
  isMaintenance: boolean;
}

export function ServerManagement({
  serverId,
  isMaintenance,
}: ServerManagementProps) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Server Management</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Operational actions are disabled while the server is in maintenance
        mode.
      </p>
      <div className="flex flex-col gap-3">
        <WhitelistResync serverId={serverId} isMaintenance={isMaintenance} />
      </div>
    </div>
  );
}
