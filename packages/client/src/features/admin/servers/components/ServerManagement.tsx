import { WhitelistResync } from "./WhitelistResync";

interface ServerManagementProps {
  serverId: number;
}

export function ServerManagement({ serverId }: ServerManagementProps) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Server Management</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Operational actions that talk to the game server directly.
      </p>
      <div className="flex flex-col gap-3">
        <WhitelistResync serverId={serverId} />
      </div>
    </div>
  );
}
