import { BadRequestError, InternalServerError } from "@/app/middleware";
import { getServerByIp, isValidServerId } from "@/services/playtime/config";
import type { Request } from "express";

/**
 * Resolves the originating Minecraft server id for a mod request. Requires a
 * verified server IP on the request. An explicit `serverId` in the request
 * body must name a configured server and, whenever the verified IP maps to a
 * configured server, must match it; otherwise the IP mapping alone decides.
 * `context` labels the warning logged when a request is rejected.
 */
export function resolveServerId(req: Request, context: string): number {
  const serverIp = req.serverIp;
  if (!serverIp) {
    throw new InternalServerError(
      "Server IP not detected - IP verification middleware may not be properly configured",
    );
  }

  const ipServer = getServerByIp(serverIp);
  const bodyServerId = (req.body as { serverId?: unknown })?.serverId;

  if (bodyServerId !== undefined && bodyServerId !== null) {
    const parsed =
      typeof bodyServerId === "number"
        ? bodyServerId
        : parseInt(String(bodyServerId), 10);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestError("Invalid serverId format");
    }
    if (!isValidServerId(parsed)) {
      logger.warn(
        `${context} rejected: unknown serverId ${parsed} (server IP: ${serverIp})`,
      );
      throw new BadRequestError("Unknown serverId");
    }
    if (ipServer && ipServer.serverId !== parsed) {
      logger.warn(
        `${context} rejected: serverId ${parsed} does not match server ${ipServer.serverId} resolved from IP ${serverIp}`,
      );
      throw new BadRequestError(
        "serverId does not match the originating server",
      );
    }
    return parsed;
  }

  if (!ipServer) {
    logger.warn(`${context} from unknown server IP: ${serverIp}`);
    throw new BadRequestError(
      `Server IP ${serverIp} is not configured. Please contact an administrator`,
    );
  }

  return ipServer.serverId;
}
