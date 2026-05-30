import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getServerByIp } from "@/services/playtime/config";
import type { Request } from "express";

/**
 * Resolves the originating Minecraft server id for a mod request. An explicit
 * `serverId` in the request body takes priority; otherwise the IP verified by
 * the middleware is mapped to a configured server. `context` labels the warning
 * logged when the request comes from an unrecognized server IP.
 */
export function resolveServerId(req: Request, context: string): number {
  const bodyServerId = (req.body as { serverId?: unknown })?.serverId;

  if (bodyServerId !== undefined && bodyServerId !== null) {
    const parsed =
      typeof bodyServerId === "number"
        ? bodyServerId
        : parseInt(String(bodyServerId), 10);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestError("Invalid serverId format");
    }
    return parsed;
  }

  const serverIp = req.serverIp;
  if (!serverIp) {
    throw new InternalServerError(
      "Server IP not detected - IP verification middleware may not be properly configured",
    );
  }

  const serverInfo = getServerByIp(serverIp);
  if (!serverInfo) {
    logger.warn(`${context} from unknown server IP: ${serverIp}`);
    throw new BadRequestError(
      `Server IP ${serverIp} is not configured. Please contact an administrator`,
    );
  }
  return serverInfo.serverId;
}
