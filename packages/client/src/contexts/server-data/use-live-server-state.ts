import { presenceOf } from "@/components/presence";
import type { RouterOutput } from "@/lib/trpc";
import { useServerData } from "./use-server-data";

type ServerSnapshot = Pick<
  RouterOutput["admin"]["servers"]["get"]["server"],
  "serverId" | "status" | "maintenance" | "playerCount"
>;

export function useLiveServerState(server: ServerSnapshot) {
  const { getServer } = useServerData();
  const live = getServer(server.serverId);

  const online = live?.online ?? server.status === "online";
  const maintenance = live?.maintenance ?? server.maintenance;

  return {
    online,
    maintenance,
    playerCount: live?.playerCount ?? server.playerCount,
    presence: presenceOf({ online, maintenance }),
  };
}
